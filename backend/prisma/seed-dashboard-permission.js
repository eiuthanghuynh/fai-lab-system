require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding VIEW_DASHBOARD permission...');

  // 1. Upsert VIEW_DASHBOARD permission
  const perm = await prisma.permission.upsert({
    where: { name: 'VIEW_DASHBOARD' },
    update: {
      description: 'View dashboard and aggregated statistics'
    },
    create: {
      name: 'VIEW_DASHBOARD',
      description: 'View dashboard and aggregated statistics'
    }
  });

  console.log(`Permission VIEW_DASHBOARD (ID: ${perm.id}) seeded.`);

  // 2. Fetch target roles
  const targetRoles = ['Admin', 'Engineer', 'Supervisor'];
  const roles = await prisma.role.findMany({
    where: {
      name: { in: targetRoles }
    }
  });

  // 3. Link permission to roles
  for (const role of roles) {
    // Check if link exists
    const existingLink = await prisma.rolePermission.findUnique({
      where: {
        role_id_permission_id: {
          role_id: role.id,
          permission_id: perm.id
        }
      }
    });

    if (!existingLink) {
      await prisma.rolePermission.create({
        data: {
          role_id: role.id,
          permission_id: perm.id
        }
      });
      console.log(`Linked VIEW_DASHBOARD to ${role.name}`);
    } else {
      console.log(`VIEW_DASHBOARD already linked to ${role.name}`);
    }
  }

  console.log('Dashboard permission seeding complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
