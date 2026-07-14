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
  console.log('Seeding new dashboard permissions...');

  const permissions = [
    { name: 'VIEW_FIRST_PASS_YEILD', description: 'View First Pass Yield charts in dashboard' },
    { name: 'VIEW_DASHBOARD_FAI', description: 'View dashboard and aggregated statistics for FAI' },
    { name: 'VIEW_DASHBOARD_LAB', description: 'View dashboard and aggregated statistics for LAB' }
  ];

  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { name: p.name },
      update: { description: p.description },
      create: {
        name: p.name,
        description: p.description
      }
    });
    console.log(`Permission ${p.name} (ID: ${perm.id}) seeded.`);
  }

  // Bind these permissions to Admin role if it exists
  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  });

  if (adminRole) {
    for (const p of permissions) {
      const perm = await prisma.permission.findUnique({ where: { name: p.name } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: adminRole.id,
              permission_id: perm.id
            }
          },
          update: {},
          create: {
            role_id: adminRole.id,
            permission_id: perm.id
          }
        });
        console.log(`Linked ${p.name} to Admin role`);
      }
    }
  }

  console.log('Dashboard permissions seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
