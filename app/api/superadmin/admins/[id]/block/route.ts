// filepath: app/api/superadmin/admins/[id]/block/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const adminId = parseInt(id);

    if (isNaN(adminId)) {
      return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
    }

    // Get the admin to toggle
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Toggle block status
    const newBlockedStatus = !admin.isBlocked;
    
    // Update admin
    await prisma.user.update({
      where: { id: adminId },
      data: { isBlocked: newBlockedStatus },
    });

    // CASCADING BLOCK: If blocking an admin, also block all users created by that admin
    if (newBlockedStatus) {
      const usersToBlock = await prisma.user.findMany({
        where: { parentAdminId: adminId },
      });

      for (const user of usersToBlock) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isBlocked: true },
        });
      }
    } else {
      // If unblocking, also unblock all users created by that admin
      const usersToUnblock = await prisma.user.findMany({
        where: { parentAdminId: adminId },
      });

      for (const user of usersToUnblock) {
        await prisma.user.update({
          where: { id: user.id },
          data: { isBlocked: false },
        });
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: 'BLOCK',
        details: `${newBlockedStatus ? 'Blocked' : 'Unblocked'} admin: ${admin.name} (${admin.userId})`,
        userId: session.userId,
      },
    });

    return NextResponse.json({
      success: true,
      isBlocked: newBlockedStatus,
    });
  } catch (error) {
    console.error('Block Admin Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}