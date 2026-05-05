// filepath: app/api/user/folders/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's categories via the explicit M:N join table
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        userCategories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!user || user.userCategories.length === 0) {
      return NextResponse.json([]);
    }

    // Get category IDs
    const categoryIds = user.userCategories.map(uc => uc.categoryId);

    // Get folders that have access to these categories
    const folderAccesses = await prisma.folderAccess.findMany({
      where: {
        categoryId: {
          in: categoryIds,
        },
      },
      include: {
        folder: {
          include: {
            accesses: {
              include: {
                category: true,
              },
            },
            documents: true,
            admin: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Get unique folders
    const foldersMap = new Map();
    folderAccesses.forEach(access => {
      if (!foldersMap.has(access.folder.id)) {
        const folder = access.folder;
        const documentsSize = folder.documents.reduce((acc, doc) => acc + doc.sizeInBytes, 0);
        
        foldersMap.set(access.folder.id, {
          ...folder,
          documentsCount: folder.documents.length,
          totalSize: folder.sizeInBytes + documentsSize,
        });
      }
    });

    const folders = Array.from(foldersMap.values());

    return NextResponse.json(folders);
  } catch (error) {
    console.error('Get User Folders Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}