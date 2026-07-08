const fs = require('fs');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

let connectionString = process.env.DATABASE_URL;

// If running inside Docker container, route localhost to the db container
if (fs.existsSync('/.dockerenv') && connectionString) {
  connectionString = connectionString.replace('localhost:5433', 'db:5433');
}

const pool = new Pool({
  connectionString
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
