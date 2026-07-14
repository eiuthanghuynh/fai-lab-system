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
  console.log('Starting supplier migration...');

  // Get distinct supplier names from fai_requests
  const distinctSuppliers = await prisma.faiRequest.findMany({
    distinct: ['supplier_name'],
    select: {
      supplier_name: true
    },
    where: {
      supplier_name: {
        not: null
      }
    }
  });

  const names = distinctSuppliers
    .map(s => s.supplier_name?.trim())
    .filter(name => name && name !== '');

  console.log(`Found ${names.length} distinct supplier names.`);

  for (const name of names) {
    // Check if supplier already exists
    let supplier = await prisma.supplier.findUnique({
      where: { name }
    });

    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          name,
          full_name: name
        }
      });
      console.log(`Created supplier: ${name} (ID: ${supplier.id})`);
    }

    // Update all requests with this supplier_name
    const updateResult = await prisma.faiRequest.updateMany({
      where: {
        supplier_name: name,
        supplier_id: null
      },
      data: {
        supplier_id: supplier.id
      }
    });

    console.log(`Updated ${updateResult.count} FAI requests for supplier ${name}.`);
  }

  console.log('Migration complete.');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
