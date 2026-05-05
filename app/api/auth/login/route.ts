// filepath: app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSession, checkUserAccess, verifyPassword } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'UserID and password are required' }, { status: 400 });
    }

    // --- STATIC SUPERADMIN FALLBACK ---
    // Auto-create superadmin on first login if DB was wiped
    if (userId === 'superadmin' && password === 'superadmin123') {
      const existingSuperadmin = await prisma.user.findUnique({ where: { userId: 'superadmin' } });
      if (!existingSuperadmin) {
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('superadmin123', 10);
        await prisma.user.create({
          data: {
            name: 'Super Admin',
            userId: 'superadmin',
            password: hashedPassword,
            role: 'SUPERADMIN',
            isBlocked: false,
          },
        });
      }
    }
    // ----------------------------------

    // Find user by userId
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Check if user is blocked (with cascading check)
    const accessCheck = await checkUserAccess(user.id);
    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.reason }, { status: 403 });
    }

    // Create session
    await setSession({
      id: user.id,
      userId: user.userId,
      role: user.role,
      name: user.name,
      parentAdminId: user.parentAdminId,
    });

    // Log the login action
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN',
        details: 'User logged in successfully',
        userId: user.id,
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
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}