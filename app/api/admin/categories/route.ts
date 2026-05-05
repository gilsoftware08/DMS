import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await prisma.category.findMany({
      where: {
        adminId: session.userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Get Categories Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Check if a category with this name already exists for this admin
    const existingCategory = await prisma.category.findFirst({
      where: {
        name: name.trim(),
        adminId: session.userId,
      },
    });

    if (existingCategory) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        adminId: session.userId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        details: `Created category: "${name.trim()}"`,
        userId: session.userId,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Create Category Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}