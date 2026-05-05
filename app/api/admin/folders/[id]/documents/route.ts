// filepath: app/api/admin/folders/[id]/documents/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const folderId = parseInt(id);

    // Verify folder belongs to this admin
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, adminId: session.userId },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const documents = await prisma.document.findMany({
      where: { folderId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Get Documents Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}