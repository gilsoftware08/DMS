// filepath: prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Check if superadmin already exists
  const existingSuperadmin = await prisma.user.findUnique({
    where: { userId: 'superadmin' },
  });

  if (existingSuperadmin) {
    console.log('✅ Superadmin already exists');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('superadmin123', 10);

  // Create Superadmin
  const superadmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      userId: 'superadmin',
      password: hashedPassword,
      role: 'SUPERADMIN',
      isBlocked: false,
    },
  });

  console.log('✅ Superadmin created successfully!');
  console.log(`   UserID: superadmin`);
  console.log(`   Password: superadmin123`);
  console.log(`   Role: SUPERADMIN`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });