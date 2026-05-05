import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const folders = await prisma.folder.findMany({
    include: { documents: true },
  });
  return NextResponse.json(folders);
}