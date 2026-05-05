// filepath: app/api/admin/folders/[id]/access/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const folderId = parseInt(id);
    const { categoryIds } = await req.json();

    // Verify folder belongs to this admin
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, adminId: session.userId },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Delete existing accesses
    await prisma.folderAccess.deleteMany({
      where: { folderId },
    });

    // Create new accesses
    if (categoryIds?.length > 0) {
      await prisma.folderAccess.createMany({
        data: categoryIds.map((catId: number) => ({
          folderId,
          categoryId: catId,
        })),
      });
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        details: `Updated folder access: ${folder.name}`,
        userId: session.userId,
        folderId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update Folder Access Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}