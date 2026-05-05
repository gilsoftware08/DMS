// filepath: app/api/superadmin/admins/create/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, userId, password } = await req.json();

    if (!name || !userId || !password) {
      return NextResponse.json({ error: 'Name, UserID, and Password are required' }, { status: 400 });
    }

    // Check if userId already exists
    const existingUser = await prisma.user.findUnique({
      where: { userId },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'UserID already exists' }, { status: 400 });
    }

    // Create admin
    const hashedPassword = await hashPassword(password);
    const admin = await prisma.user.create({
      data: {
        name,
        userId,
        password: hashedPassword,
        role: 'ADMIN',
        isBlocked: false,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        details: `Created admin: ${name} (${userId})`,
        userId: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        name: admin.name,
        userId: admin.userId,
        role: admin.role,
        isBlocked: admin.isBlocked,
      },
    });
  } catch (error) {
    console.error('Create Admin Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}