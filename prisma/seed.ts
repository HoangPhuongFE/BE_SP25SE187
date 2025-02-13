import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

async function createRoles() {
  await prisma.role.deleteMany();
  console.log('Deleted all existing roles.');

  const roles = [
    { name: 'academic_officer', description: 'Academic Officer/Cán bộ học vụ' },
    { name: 'graduation_thesis_manager', description: 'Graduation Thesis Manager/Người quản lý luận văn tốt nghiệp' },
    { name: 'examination_officer', description: 'Examination Officer/Cán bộ kiểm tra' },
    { name: 'reviewer', description: 'Người phản biện' },
    { name: 'chairman', description: 'Chủ tịch hội đồng' },
    { name: 'secretary', description: 'Thư ký hội đồng' },
    { name: 'lecturer', description: 'Giảng viên' },
    { name: 'mentor', description: 'Người hướng dẫn (Mentor)' },
    { name: 'leader', description: 'Trưởng nhóm' },
    { name: 'student', description: 'Sinh viên (Student Groups/Students)' },
    { name: 'admin', description: 'Quản trị viên (Admin)' }
  ];


  for (const role of roles) {
    const createdRole = await prisma.role.create({ data: role });
    console.log(`Created role: ${createdRole.name} with ID: ${createdRole.id}`);
  }
}

async function createDefaultUsers() {
  const defaultUsers = [
    {
      email: 'academic.officer@gmail.com',
      username: 'academic_officer',
      password: await hashPassword('123456'),
      fullName: 'Academic Officer User',
      roleName: 'academic_officer',
    },
    {
      email: 'thesis.manager@gmail.com',
      username: 'graduation_thesis_manager',
      password: await hashPassword('123456'),
      fullName: 'Graduation Thesis Manager User',
      roleName: 'graduation_thesis_manager',
    },
    {
      email: 'examination.officer@gmail.com',
      username: 'examination_officer',
      password: await hashPassword('123456'),
      fullName: 'Examination Officer User',
      roleName: 'examination_officer',
    },
    {
      email: 'mentor00@gmail.com',
      username: 'mentor00',
      password: await hashPassword('123456'),
      fullName: 'Mentor User',
      roleName: 'mentor',
    },
    {
      email: 'mentor11@gmail.com',
      username: 'mentor11',
      password: await hashPassword('123456'),
      fullName: 'Mentor User11',
      roleName: 'mentor',
    },
    {
      email: 'lecturer@gmail.com',
      username: 'lecturer',
      password: await hashPassword('123456'),
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

  const years = [{ year: 2024 }, { year: 2025 }, { year: 2026 }];
  const createdYears: { [key: number]: string } = {};

  for (const year of years) {
    const createdYear = await prisma.year.create({ data: year });
    createdYears[year.year] = createdYear.id;
    console.log(`Created year: ${year.year} with ID: ${createdYear.id}`);
  }

  const semesters = [
    { code: 'SPRING2024', startDate: new Date('2025-01-01'), endDate: new Date('2024-04-30'), status: 'COMPLETE', yearId: createdYears[2024] },
    { code: 'SUMMER2024', startDate: new Date('2025-05-01'), endDate: new Date('2024-08-31'), status: 'COMPLETE', yearId: createdYears[2024] },
    { code: 'FALL2024', startDate: new Date('2025-09-01'), endDate: new Date('2024-12-31'), status: 'COMPLETE', yearId: createdYears[2024] },
    { code: 'SPRING2025', startDate: new Date('2025-01-01'), endDate: new Date('2025-04-30'), status: 'ACTIVE', yearId: createdYears[2025] },
    { code: 'SUMMER2025', startDate: new Date('2025-05-01'), endDate: new Date('2025-08-31'), status: 'UPCOMING', yearId: createdYears[2025] },
    { code: 'FALL2025', startDate: new Date('2025-09-01'), endDate: new Date('2025-12-31'), status: 'UPCOMING', yearId: createdYears[2025] },
    { code: 'SPRING2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-04-30'), status: 'UPCOMING', yearId: createdYears[2026] },
    { code: 'SUMMER2026', startDate: new Date('2026-05-01'), endDate: new Date('2026-08-31'), status: 'UPCOMING', yearId: createdYears[2026] },
    { code: 'FALL2026', startDate: new Date('2026-09-01'), endDate: new Date('2026-12-31'), status: 'UPCOMING', yearId: createdYears[2026] },
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
