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
  console.log('Seeding suppliers...');

  const suppliers = [
    { name: 'WANG TAK', full_name: 'Wang Tak Metal Manufactory Limited' },
    { name: 'AMEYA', full_name: 'AMEYA HOLDING LIMITED' },
    { name: 'AN VIET PHAT', full_name: null },
    { name: 'CEE', full_name: null },
    { name: 'CHANGZHOU', full_name: null },
    { name: 'CHENGDA', full_name: null },
    { name: 'DENSETING', full_name: null },
    { name: 'EPE', full_name: null },
    { name: 'EVERGREEN', full_name: null },
    { name: 'HUAYI', full_name: null },
    { name: 'JETWAY', full_name: null },
    { name: 'JIJING', full_name: null },
    { name: 'KABLE-X', full_name: null },
    { name: 'MINGSHIN', full_name: null },
    { name: 'NEW HEART', full_name: null },
    { name: 'ORTRONICS', full_name: null },
    { name: 'PERFECT', full_name: null },
    { name: 'PHUOC HIEP THANH', full_name: null },
    { name: 'PRAMERS', full_name: null },
    { name: 'QIMAO', full_name: null },
    { name: 'RENHE', full_name: null },
    { name: 'SCHURTER', full_name: null },
    { name: 'SUNWAY', full_name: null },
    { name: 'SUZHOU HUAYI', full_name: null },
    { name: 'SUZHOU RENHE', full_name: null },
    { name: 'SUZHOU SUNWAY', full_name: 'SUZHOU RENHE HOLDING CO.,LTD' },
    { name: 'SWARM BOBBIN', full_name: null },
    { name: 'TARRY', full_name: null },
    { name: 'WELGAO', full_name: null },
    { name: 'YJN', full_name: null },
    { name: 'YOLUCKY', full_name: null }
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { name: s.name },
      update: { full_name: s.full_name },
      create: { name: s.name, full_name: s.full_name }
    });
  }

  console.log('Suppliers seeded successfully!');
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
