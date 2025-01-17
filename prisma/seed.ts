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
      password: await hashPassword('12345'),
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

async function main() {
  console.log('Seeding database...');

  // Tạo roles
  await createRoles();

  // Tạo người dùng mặc định
  await createDefaultUsers();

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
