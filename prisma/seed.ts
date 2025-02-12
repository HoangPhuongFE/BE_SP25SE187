import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

async function createRoles() {
  // Xóa tất cả roles hiện có
  await prisma.role.deleteMany();
  console.log('Deleted all existing roles.');

  // Danh sách roles
  const roles = [
    { id: 'student-role-id', name: 'student', description: 'Sinh viên' },
    { id: 'lecturer-role-id', name: 'lecturer', description: 'Giảng viên' },
    { id: 'head-of-department-role-id', name: 'head_of_department', description: 'Trưởng bộ môn' },
    { id: 'dean-role-id', name: 'dean', description: 'Trưởng khoa' },
    { id: 'reviewer-role-id', name: 'reviewer', description: 'Người phản biện' },
    { id: 'mentor-role-id', name: 'mentor', description: 'Người hướng dẫn' },
    { id: 'chairman-role-id', name: 'chairman', description: 'Chủ tịch hội đồng' },
    { id: 'secretary-role-id', name: 'secretary', description: 'Thư ký hội đồng' },
    { id: 'admin-role-id', name: 'admin', description: 'Quản trị viên' },
    { id: 'leader-role-id', name: 'leader', description: 'Trưởng nhóm' },


  ];

  // Tạo roles trong cơ sở dữ liệu
  for (const role of roles) {
    await prisma.role.create({
      data: role,
    });
    console.log(`Created role: ${role.name}`);
  }
}

async function createDefaultUsers() {
  // Danh sách người dùng mặc định
  const defaultUsers = [
    
    {
      email: 'lecturer@gmail.com',
      username: 'lecturer',
      password: await hashPassword('lecturer12345'),
      fullName: 'Lecturer User',
      roleId: 'lecturer-role-id',
    },
    {
      email: 'admin@gmail.com',
      username: 'admin',
      password: await hashPassword('admin12345'),
      fullName: 'Admin User',
      roleId: 'admin-role-id',
    },
  ];

  // Tạo users và liên kết với roles
  for (const user of defaultUsers) {
    const roleExists = await prisma.role.findUnique({
      where: { id: user.roleId },
    });

    if (!roleExists) {
      throw new Error(`Role with ID ${user.roleId} does not exist`);
    }

    await prisma.user.create({
      data: {
        email: user.email,
        username: user.username,
        passwordHash: user.password,
        fullName: user.fullName,
        roles: {
          create: {
            roleId: user.roleId,
            isActive: true,
          },
        },
      },
    });

    console.log(`User created: ${user.username}`);
  }
}

async function createYearsAndSemesters() {
  // Xóa tất cả các năm và học kỳ hiện có
  await prisma.semester.deleteMany();
  await prisma.year.deleteMany();
  console.log('Deleted all existing years and semesters.');

  // Danh sách các năm
  const years = [
    { year: 2025 },
    { year: 2026 },
  ];

  // Tạo các năm trong cơ sở dữ liệu và lưu lại ID
  const createdYears: { [key: number]: string } = {};
  for (const year of years) {
    const createdYear = await prisma.year.create({
      data: year,
    });
    createdYears[year.year] = createdYear.id; // Lưu lại ID thực tế
    console.log(`Created year: ${year.year} with ID: ${createdYear.id}`);
  }

  // Danh sách các học kỳ (dùng ID thật thay vì đặt thủ công)
  const semesters = [
    {
      code: 'SPRING',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-04-30'),
      registrationDeadline: new Date('2024-12-15'),
      status: 'COMPLETE',
      yearId: createdYears[2025], // Lấy ID từ danh sách đã tạo
    },
    {
      code: 'SUMMER',
      startDate: new Date('2025-05-01'),
      endDate: new Date('2025-08-31'),
      registrationDeadline: new Date('2025-04-15'),
      status: 'ACTIVE',
      yearId: createdYears[2025],
    },
    {
      code: 'FALL',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-31'),
      registrationDeadline: new Date('2025-08-15'),
      status: 'ACTIVE',
      yearId: createdYears[2025],
    },
    {
      code: 'SPRING',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-04-30'),
      registrationDeadline: new Date('2025-12-15'),
      status: 'ACTIVE',
      yearId: createdYears[2026],
    },
    {
      code: 'SUMMER',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      registrationDeadline: new Date('2026-04-15'),
      status: 'ACTIVE',
      yearId: createdYears[2026],
    },
    {
      code: 'FALL',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-31'),
      registrationDeadline: new Date('2026-08-15'),
      status: 'ACTIVE',
      yearId: createdYears[2026],
    },
  ];

  // Tạo các học kỳ trong cơ sở dữ liệu
  for (const semester of semesters) {
    await prisma.semester.create({
      data: semester,
    });
    console.log(`Created semester: ${semester.code} for year ${semester.yearId}`);
  }
}


async function main() {
  console.log('Seeding database...');

  // Tạo roles
  await createRoles();

  // Tạo người dùng mặc định
  await createDefaultUsers();

  // Tạo năm và học kỳ
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