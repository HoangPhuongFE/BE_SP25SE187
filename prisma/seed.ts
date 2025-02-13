import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

async function createRoles() {
  await prisma.role.deleteMany();
  console.log('Deleted all existing roles.');

  const roles = [
    { name: 'student', description: 'Sinh viên' },
    { name: 'lecturer', description: 'Giảng viên' },
    { name: 'head_of_department', description: 'Trưởng bộ môn' },
    { name: 'dean', description: 'Trưởng khoa' },
    { name: 'reviewer', description: 'Người phản biện' },
    { name: 'mentor', description: 'Người hướng dẫn' },
    { name: 'chairman', description: 'Chủ tịch hội đồng' },
    { name: 'secretary', description: 'Thư ký hội đồng' },
    { name: 'admin', description: 'Quản trị viên' },
    { name: 'leader', description: 'Trưởng nhóm' },
  ];

  for (const role of roles) {
    const createdRole = await prisma.role.create({ data: role });
    console.log(`Created role: ${createdRole.name} with ID: ${createdRole.id}`);
  }
}

async function createDefaultUsers() {
  const defaultUsers = [
    {
      email: 'lecturer@gmail.com',
      username: 'lecturer',
      password: await hashPassword('lecturer12345'),
      fullName: 'Lecturer User',
      roleName: 'lecturer',
    },
    {
      email: 'admin@gmail.com',
      username: 'admin',
      password: await hashPassword('admin12345'),
      fullName: 'Admin User',
      roleName: 'admin',
    },
  ];

  for (const user of defaultUsers) {
    const role = await prisma.role.findUnique({
      where: { name: user.roleName },
    });

    if (!role) {
      throw new Error(`Role with name ${user.roleName} does not exist`);
    }

    await prisma.user.create({
      data: {
        email: user.email,
        username: user.username,
        passwordHash: user.password,
        fullName: user.fullName,
        roles: {
          create: {
            roleId: role.id,
            isActive: true,
          },
        },
      },
    });

    console.log(`User created: ${user.username}`);
  }
}

async function createYearsAndSemesters() {
  await prisma.semester.deleteMany();
  await prisma.year.deleteMany();
  console.log('Deleted all existing years and semesters.');

  const years = [{ year: 2025 }, { year: 2026 }];
  const createdYears: { [key: number]: string } = {};

  for (const year of years) {
    const createdYear = await prisma.year.create({ data: year });
    createdYears[year.year] = createdYear.id;
    console.log(`Created year: ${year.year} with ID: ${createdYear.id}`);
  }

  const semesters = [
    { code: 'SPRING', startDate: new Date('2025-01-01'), endDate: new Date('2025-04-30'), registrationDeadline: new Date('2024-12-15'), status: 'COMPLETE', yearId: createdYears[2025] },
    { code: 'SUMMER', startDate: new Date('2025-05-01'), endDate: new Date('2025-08-31'), registrationDeadline: new Date('2025-04-15'), status: 'ACTIVE', yearId: createdYears[2025] },
    { code: 'FALL', startDate: new Date('2025-09-01'), endDate: new Date('2025-12-31'), registrationDeadline: new Date('2025-08-15'), status: 'ACTIVE', yearId: createdYears[2025] },
    { code: 'SPRING', startDate: new Date('2026-01-01'), endDate: new Date('2026-04-30'), registrationDeadline: new Date('2025-12-15'), status: 'ACTIVE', yearId: createdYears[2026] },
    { code: 'SUMMER', startDate: new Date('2026-05-01'), endDate: new Date('2026-08-31'), registrationDeadline: new Date('2026-04-15'), status: 'ACTIVE', yearId: createdYears[2026] },
    { code: 'FALL', startDate: new Date('2026-09-01'), endDate: new Date('2026-12-31'), registrationDeadline: new Date('2026-08-15'), status: 'ACTIVE', yearId: createdYears[2026] },
  ];

  for (const semester of semesters) {
    await prisma.semester.create({ data: semester });
    console.log(`Created semester: ${semester.code} for year ${semester.yearId}`);
  }
}

async function main() {
  console.log('Seeding database...');
  await createRoles();
  await createDefaultUsers();
  await createYearsAndSemesters();
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
