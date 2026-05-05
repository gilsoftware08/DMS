// filepath: lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-key-change-in-production');

export interface JWTPayload {
  userId: number;
  userIdString: string;
  role: string;
  name: string;
  parentAdminId?: number;
  [key: string]: any;
}

export async function createToken(user: {
  id: number;
  userId: string;
  role: string;
  name: string;
  parentAdminId?: number | null;
}): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    userIdString: user.userId,
    role: user.role,
    name: user.name,
    parentAdminId: user.parentAdminId,
  } as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return token;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return null;

  return verifyToken(token);
}

export async function setSession(user: {
  id: number;
  userId: string;
  role: string;
  name: string;
  parentAdminId?: number | null;
}) {
  const token = await createToken(user);
  const cookieStore = await cookies();
  
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function removeSession() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

// Check if user is blocked - handles cascading block
export async function checkUserAccess(userId: number): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      parentAdmin: true,
    },
  });

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.isBlocked) {
    return { allowed: false, reason: 'Your account has been blocked' };
  }

  // Check if parent admin is blocked (cascading block)
  if (user.parentAdminId) {
    const parentAdmin = await prisma.user.findUnique({
      where: { id: user.parentAdminId },
    });

    if (parentAdmin?.isBlocked) {
      return { allowed: false, reason: 'Your admin has been blocked. Contact support.' };
    }

    if (parentAdmin?.role !== 'ADMIN') {
      return { allowed: false, reason: 'Invalid admin relationship' };
    }
  }

  return { allowed: true };
}

// Hash password using bcrypt
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcrypt');
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(password, hash);
}