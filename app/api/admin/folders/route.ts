// filepath: app/api/admin/folders/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folders = await prisma.folder.findMany({
      where: {
        adminId: session.userId,
        isDeleted: false, // Exclude soft-deleted folders
      },
      include: {
        accesses: {
          include: {
            category: true,
          },
        },
        documents: {
          where: { isDeleted: false }, // Exclude soft-deleted documents
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Recalculate storage from live (non-deleted) documents only
    const foldersWithStorage = folders.map(folder => {
      const documentsSize = folder.documents.reduce((acc, doc) => acc + doc.sizeInBytes, 0);
      return {
        ...folder,
        documentsCount: folder.documents.length,
        totalSize: documentsSize, // Use document sum — sizeInBytes on folder is a running total
      };
    });

    return NextResponse.json(foldersWithStorage);
  } catch (error) {
    console.error('Get Folders Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, categoryIds } = await req.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // Create folder with optional category access
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        adminId: session.userId,
        accesses: categoryIds?.length > 0
          ? {
              create: categoryIds.map((catId: number) => ({
                categoryId: catId,
              })),
            }
          : undefined,
      },
      include: {
        accesses: {
          include: {
            category: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        details: `Created folder: "${name.trim()}"`,
        userId: session.userId,
        folderId: folder.id,
      },
    });

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    console.error('Create Folder Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}