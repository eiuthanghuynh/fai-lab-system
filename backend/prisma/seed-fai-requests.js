require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20
});

async function main() {
  console.log('Seeding fake FaiRequests...');
  const client = await pool.connect();
  let userId, commodities;
  
  try {
    const userRes = await client.query('SELECT id FROM users LIMIT 1');
    const commRes = await client.query('SELECT id FROM commodity_parts');

    if (userRes.rows.length === 0 || commRes.rows.length === 0) {
      console.error('Missing User or CommodityParts in database. Cannot seed.');
      process.exit(1);
    }

    userId = userRes.rows[0].id;
    commodities = commRes.rows.map(r => r.id);
  } finally {
    client.release();
  }
    
  const statuses = ['Closed', 'Ongoing', 'Assigned', 'Backlog', 'Draft'];

  // Pre-generate a random pass rate (90% - 98%) for each of the 52 weeks
  const weekPassRates = {};
  for (let w = 1; w <= 52; w++) {
    weekPassRates[w] = 0.90 + (Math.random() * 0.08);
  }

  const totalRecords = 1800000;
  const chunkSize = 10000;
  let totalInserted = 0;
  
  const promises = [];

  for (let i = 0; i < totalRecords; i += chunkSize) {
    const limit = Math.min(i + chunkSize, totalRecords);
    const values = [];

    for (let j = i; j < limit; j++) {
      const week_no = Math.floor(Math.random() * 52) + 1;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      let result = null;
      if (status === 'Closed') {
        result = Math.random() < weekPassRates[week_no] ? 'Pass' : 'Fail';
      }
      
      const commId = commodities[Math.floor(Math.random() * commodities.length)];

      values.push(`(${userId}, 'Fake Project ${j}', 'PN-${j}', ${commId}, ${week_no}, '${status}', ${result ? `'${result}'` : 'NULL'}, 1, 1, true, '{}'::jsonb, NOW(), NOW())`);
    }

    const query = `
      INSERT INTO fai_requests (
        requestor_id, project_name, part_no, commodity_part, 
        week_no, status, result, sample_qty, submission_time, 
        is_active, form_data, created_at, updated_at
      ) VALUES ${values.join(',')}
    `;

    // Fire query asynchronously into the pool
    const p = pool.query(query).then(() => {
      totalInserted += (limit - i);
      console.log(`Seeded ${totalInserted} / ${totalRecords} FaiRequests...`);
    });
    
    promises.push(p);
  }

  await Promise.all(promises);
  console.log(`Successfully seeded ${totalInserted} FaiRequests.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
