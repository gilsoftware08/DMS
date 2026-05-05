// filepath: app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: {
        parentAdminId: session.userId,
        role: 'USER',
        isDeleted: false, // Exclude soft-deleted users
      },
      include: {
        userCategories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format for the UI
    const formattedUsers = users.map(user => ({
      ...user,
      categories: user.userCategories.map(uc => uc.category),
    }));

    return NextResponse.json(formattedUsers);
  } catch (error) {
    console.error('Get Users Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, userId, password, categoryId } = await req.json();

    if (!name || !userId || !password || !categoryId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Check if userId already exists (including soft-deleted — userId must be globally unique)
    const existingUser = await prisma.user.findUnique({
      where: { userId },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'UserID already exists' }, { status: 400 });
    }

    // Verify category belongs to this admin
    const category = await prisma.category.findFirst({
      where: { id: parseInt(categoryId), adminId: session.userId },
    });

    if (!category) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        userId,
        password: hashedPassword,
        role: 'USER',
        parentAdminId: session.userId,
        userCategories: {
          create: { categoryId: parseInt(categoryId) },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        details: `Created user: ${name} (${userId}) in category: ${category.name}`,
        userId: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        userId: user.userId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Create User Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}