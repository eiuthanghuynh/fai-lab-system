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
    { name: 'ADMINISTRATOR', description: 'Manage users, roles, FAI failure modes, suppliers, commodity parts' },
    { name: 'SUBMIT_FAI_REQUEST', description: 'Create and submit FAI requests' },
    { name: 'MANAGE_REQUEST_LIST', description: 'Manage FAI request list and perform administrative actions like hard deletion' },
    { name: 'ASSIGN_FAI', description: 'Assign an inspector to FAI requests' },
    { name: 'INSPECT_FAI', description: 'Inspect FAI requests and make reports' },
    { name: 'SUBMIT_LAB_REQUEST', description: 'Create and submit LAB requests' },
    { name: 'ASSIGN_LAB', description: 'Assign inspector to LAB Request' },
    { name: 'INSPECT_LAB', description: 'Create LAB Work Orders and make reports to each order' },
    { name: 'VIEW_DASHBOARD_FAI', description: 'View dashboard and aggregated statistics for FAI' },
    { name: 'VIEW_DASHBOARD_LAB', description: 'View dashboard and aggregated statistics for LAB' },
    { name: 'VIEW_FIRST_PASS_YIELD', description: 'View First Pass Yield charts in dashboard' },
    { name: 'APPROVE_LAB_ENGINEER', description: 'Perform Lab Engineer approval on LAB requests' },
    { name: 'APPROVE_LAB_MANAGER', description: 'Perform Quality Manager approval on LAB requests' }
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
      seededPermissions['ADMINISTRATOR'],
      seededPermissions['SUBMIT_FAI_REQUEST'],
      seededPermissions['MANAGE_REQUEST_LIST'],
      seededPermissions['ASSIGN_FAI'],
      seededPermissions['INSPECT_FAI'],
      seededPermissions['SUBMIT_LAB_REQUEST'],
      seededPermissions['ASSIGN_LAB'],
      seededPermissions['INSPECT_LAB'],
      seededPermissions['VIEW_DASHBOARD_FAI'],
      seededPermissions['VIEW_DASHBOARD_LAB'],
      seededPermissions['VIEW_FIRST_PASS_YIELD'],
      seededPermissions['APPROVE_LAB_ENGINEER'],
      seededPermissions['APPROVE_LAB_MANAGER']
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
      full_name: 'Admin',
      employee_id: 'SYSTEM',
      email: 'admin@local.com',
      department: ''
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
    'Appearance Issue', 'Form/ Fitting Issue', 'Drawing Issue/Material Issue'
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

  // 7. Create/Upsert Suppliers
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
  console.log('Suppliers seeded.');

  const items = [
    { name: 'Drop Test' },
    { name: 'Vibration Test' },
    { name: 'Shock Test' }
  ];

  for (const item of items) {
    const existing = await prisma.itemTest.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.itemTest.create({ data: item });
      console.log(`Created item test: ${item.name}`);
    } else {
      console.log(`Item test already exists: ${item.name}`);
    }
  }

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
