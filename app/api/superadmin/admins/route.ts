// filepath: app/api/superadmin/admins/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all non-deleted admins with storage calculation
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isDeleted: false, // Exclude soft-deleted admins
      },
      include: {
        folders: {
          where: { isDeleted: false },
          include: {
            documents: {
              where: { isDeleted: false },
            },
          },
        },
        createdUsers: {
          where: { isDeleted: false },
          include: {
            folders: {
              where: { isDeleted: false },
              include: {
                documents: {
                  where: { isDeleted: false },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate real-time storage from live documents only
    const adminsWithStorage = admins.map(admin => {
      // Storage from admin's own folders' documents
      const adminFolderStorage = admin.folders.reduce((total, folder) => {
        return total + folder.documents.reduce((docTotal, doc) => docTotal + doc.sizeInBytes, 0);
      }, 0);

      // Storage from folders owned by users that this admin created
      const userFolderStorage = admin.createdUsers.reduce((total, user) => {
        return total + user.folders.reduce((folderTotal, folder) => {
          return folderTotal + folder.documents.reduce((docTotal, doc) => docTotal + doc.sizeInBytes, 0);
        }, 0);
      }, 0);

      const totalStorage = adminFolderStorage + userFolderStorage;

      return {
        id:          admin.id,
        name:        admin.name,
        userId:      admin.userId,
        isBlocked:   admin.isBlocked,
        createdAt:   admin.createdAt,
        totalStorage,
        userCount:   admin.createdUsers.length,
        folderCount: admin.folders.length,
      };
    });

    return NextResponse.json(adminsWithStorage);
  } catch (error) {
    console.error('Get Admins Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}