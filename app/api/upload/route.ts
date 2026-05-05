// filepath: app/api/upload/route.ts
// NOTE: This is the legacy upload route. The primary secured route is /api/admin/upload.
// This route now enforces authentication and correct sizeInBytes tracking.
import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    // Auth guard — must be an authenticated ADMIN
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file        = formData.get('file')        as File;
    const folderName  = formData.get('folderName')  as string;
    const sectionName = formData.get('sectionName') as string;
    const pagesString = formData.get('pages')       as string;

    if (!file || !folderName || !sectionName || !pagesString) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Convert 1-based frontend page numbers to 0-based for pdf-lib
    const selectedPages = JSON.parse(pagesString).map((p: number) => p - 1);

    const arrayBuffer  = await file.arrayBuffer();
    const originalPdf  = await PDFDocument.load(arrayBuffer);

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(originalPdf, selectedPages);
    copiedPages.forEach(page => newPdf.addPage(page));
    const newPdfBytes = await newPdf.save();

    // Exact byte size of the generated buffer — used for storage charts
    const sizeInBytes = newPdfBytes.length;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folderName);
    await mkdir(uploadDir, { recursive: true });

    const fileName = `${sectionName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, Buffer.from(newPdfBytes));

    // Upsert folder scoped to this admin
    const folder = await prisma.folder.upsert({
      where: { name: folderName } as never,
      update: {},
      create: {
        name: folderName,
        adminId: session.userId,
        sizeInBytes: 0,
      },
    });

    // Create document record with accurate sizeInBytes
    const document = await prisma.document.create({
      data: {
        name:          sectionName,
        path:          `/uploads/${folderName}/${fileName}`,
        sizeInBytes,
        originalSource: file.name,
        folderId:      folder.id,
      },
    });

    // Update folder running total
    await prisma.folder.update({
      where: { id: folder.id },
      data:  { sizeInBytes: { increment: sizeInBytes } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action:     'UPLOAD',
        details:    `Created section "${sectionName}" (${selectedPages.length} pages, ${sizeInBytes} bytes) via legacy route`,
        userId:     session.userId,
        folderId:   folder.id,
        documentId: document.id,
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}