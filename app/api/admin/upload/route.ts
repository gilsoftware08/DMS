// filepath: app/api/admin/upload/route.ts
import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folderId = parseInt(formData.get('folderId') as string);
    const sectionName = formData.get('sectionName') as string;
    const pagesString = formData.get('pages') as string;
    
    if (!file || !folderId || !sectionName || !pagesString) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Verify folder belongs to this admin
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, adminId: session.userId },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Convert 1-based frontend page numbers to 0-based for pdf-lib
    const selectedPages = JSON.parse(pagesString).map((p: number) => p - 1);

    const arrayBuffer = await file.arrayBuffer();
    const originalPdf = await PDFDocument.load(arrayBuffer);
    
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(originalPdf, selectedPages);
    copiedPages.forEach((page) => newPdf.addPage(page));
    const newPdfBytes = await newPdf.save();

    // Ensure the folder exists inside the public directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder.name);
    await mkdir(uploadDir, { recursive: true });

    // Save the physical file
    const fileName = `${sectionName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, Buffer.from(newPdfBytes));

    // Update folder size
    const newSize = folder.sizeInBytes + newPdfBytes.length;

    // Create document in database
    const document = await prisma.document.create({
      data: {
        name: sectionName,
        path: `/uploads/${folder.name}/${fileName}`,
        sizeInBytes: newPdfBytes.length,
        folderId: folderId,
      },
    });

    // Update folder size
    await prisma.folder.update({
      where: { id: folderId },
      data: { sizeInBytes: newSize },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'UPLOAD',
        details: `Created section "${sectionName}" with ${selectedPages.length} pages`,
        userId: session.userId,
        folderId: folderId,
        documentId: document.id,
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}