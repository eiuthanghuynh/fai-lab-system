require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database (upsert only)...');

  // 1. Create/Upsert Roles (using 'name' as unique identifier)
  const roles = [
    { name: 'SQE', description: 'Supplier Quality Engineer', badge_color: '#3b82f6' },
    { name: 'Technician', description: 'Lab Technician', badge_color: '#f59e0b' },
    { name: 'Supervisor', description: 'Lab Supervisor', badge_color: '#10b981' },
    { name: 'Engineer', description: 'FAI Engineer', badge_color: '#8b5cf6' },
    { name: 'Admin', description: 'System Administrator', badge_color: '#63e079' }
  ];

  const seededRoles = {};
  for (const role of roles) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        badge_color: role.badge_color
      },
      create: {
        name: role.name,
        description: role.description,
        badge_color: role.badge_color
      }
    });
    seededRoles[role.name] = r;
  }
  console.log('Roles seeded:', Object.keys(seededRoles).map(name => `${name} (ID: ${seededRoles[name].id})`));

  // 2. Create/Upsert Permissions (using 'name' as unique identifier)
  const permissions = [
    { name: 'MANAGE_USERS', description: 'Manage system users (Create, Read, Update, Delete, Restore)' },
    { name: 'MANAGE_ROLES', description: 'Manage roles and role permissions' },
    { name: 'SUBMIT_FAI_REQUEST', description: 'Create and submit FAI requests' },
    { name: 'MANAGE_REQUEST_LIST', description: 'Manage FAI request list and perform administrative actions like hard deletion' },
    { name: 'ASSIGN_FAI', description: 'Assign an inspector to FAI requests' },
    { name: 'INSPECT_FAI', description: 'Inspect FAI requests and make reports' },
    { name: 'SUBMIT_LAB_REQUEST', description: 'Create and submit LAB requests' },
    { name: 'ASSIGN_LAB', description: 'Assign inspector to LAB Request' },
    { name: 'INSPECT_LAB', description: 'Create LAB Work Orders and make reports to each order' },
    { name: 'VIEW_DASHBOARD_FAI', description: 'View dashboard and aggregated statistics for FAI' },
    { name: 'VIEW_DASHBOARD_LAB', description: 'View dashboard and aggregated statistics for LAB' }
  ];

  const seededPermissions = {};
  for (const perm of permissions) {
    const p = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {
        description: perm.description
      },
      create: {
        name: perm.name,
        description: perm.description
      }
    });
    seededPermissions[perm.name] = p;
  }
  console.log('Permissions seeded:', Object.keys(seededPermissions).map(name => `${name} (ID: ${seededPermissions[name].id})`));

  // 3. Link Admin Role to Permissions (RolePermission)
  const adminRole = seededRoles['Admin'];
  if (adminRole) {
    const adminRolePermissions = [
      seededPermissions['MANAGE_USERS'],
      seededPermissions['MANAGE_ROLES'],
      seededPermissions['SUBMIT_FAI_REQUEST'],
      seededPermissions['MANAGE_REQUEST_LIST'],
      seededPermissions['ASSIGN_FAI'],
      seededPermissions['INSPECT_FAI'],
      seededPermissions['SUBMIT_LAB_REQUEST'],
      seededPermissions['ASSIGN_LAB'],
      seededPermissions['INSPECT_LAB']
    ];

    for (const perm of adminRolePermissions) {
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: adminRole.id,
              permission_id: perm.id
            }
          },
          update: { is_active: true },
          create: {
            role_id: adminRole.id,
            permission_id: perm.id,
            is_active: true
          }
        });
      }
    }
    console.log('Admin permissions linked.');
  }

  // 4. Link SUBMIT_FAI_REQUEST to other roles (SQE, Technician, Supervisor, Engineer)
  const submitFaiRequestPerm = seededPermissions['SUBMIT_FAI_REQUEST'];
  if (submitFaiRequestPerm) {
    const otherRoleNames = ['SQE', 'Technician', 'Supervisor', 'Engineer'];
    for (const roleName of otherRoleNames) {
      const r = seededRoles[roleName];
      if (r) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: r.id,
              permission_id: submitFaiRequestPerm.id
            }
          },
          update: { is_active: true },
          create: {
            role_id: r.id,
            permission_id: submitFaiRequestPerm.id,
            is_active: true
          }
        });
      }
    }
    console.log('SUBMIT_FAI_REQUEST permission linked to all roles.');
  }

  const hashedPassword = await bcrypt.hash('xp', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: hashedPassword,
      full_name: 'System Admin',
      employee_id: 'ADMIN001',
      email: 'admin@local.com'
    }
  });

  if (adminRole) {
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: adminUser.id, role_id: adminRole.id } },
      update: {},
      create: { user_id: adminUser.id, role_id: adminRole.id }
    });
    console.log('Admin user created/verified.');
  }

  // 5. Create/Upsert FaiFailureModes
  const failureModes = [
    'Material Issue', 'Drawing Issue', 'Design Issue', 'Documents Issue', 
    'Reliability/Environmental Test Issue', 'Functional/Electrical Test Issue', 
    'Appearance issue', 'Form/ Fitting Issue', 'Drawing Issue/Material Issue'
  ];

  for (const issue of failureModes) {
    await prisma.faiFailureMode.upsert({
      where: { issue },
      update: {},
      create: { issue }
    });
  }
  console.log('FaiFailureModes seeded.');

  // 6. Create/Upsert CommodityParts
  const commodityParts = [
    'Metal', 'Foam', 'Carbon', 'PCB', 'Insulator', 'Plastic', 'Cable', 'Label', 'Bag', 'Standard Part', 'Others'
  ];

  for (const name of commodityParts) {
    await prisma.commodityPart.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log('CommodityParts seeded.');

  console.log('Database seeded successfully!');
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
