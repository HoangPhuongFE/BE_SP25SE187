import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

async function createRoles() {
  await prisma.role.deleteMany();

  const roles = [
    { name: 'admin', description: 'Quản trị viên (Admin)', isSystemWide: true },
    { name: 'academic_officer', description: 'Academic Officer/Cán bộ học vụ', isSystemWide: true },
    { name: 'graduation_thesis_manager', description: 'Graduation Thesis Manager/Người quản lý luận văn tốt nghiệp', isSystemWide: true },
    { name: 'examination_officer', description: 'Examination Officer/Cán bộ kiểm tra', isSystemWide: true },
    { name: 'student', description: 'Sinh viên (Student Groups/Students)', isSystemWide: false },
    { name: 'lecturer', description: 'Giảng viên', isSystemWide: false },
    { name: 'mentor_main', description: 'Mentor chính của nhóm', isSystemWide: false },
    { name: 'mentor_sub', description: 'Mentor phụ của nhóm', isSystemWide: false },
    { name: 'leader', description: 'Trưởng nhóm sinh viên', isSystemWide: false },
    { name: 'member', description: 'Thành viên nhóm sinh viên', isSystemWide: false },
    { name: 'council_chairman', description: 'Chủ tịch hội đồng', isSystemWide: false },
    { name: 'council_secretary', description: 'Thư ký hội đồng', isSystemWide: false },
    { name: 'council_member', description: 'Thành viên hội đồng', isSystemWide: false },
  ];

  for (const role of roles) {
    const createdRole = await prisma.role.create({ data: role });
    console.log(`Created role: ${createdRole.name} with ID: ${createdRole.id}`);
  }
}

async function createDefaultUsers() {
  // Xóa dữ liệu cũ trong bảng User và UserRole
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
// Tạo người dùng mặc định
  const defaultUsers = [
    {
      email: 'admin@gmail.com',
      username: 'admin',
      password: await hashPassword('a123456'),
      fullName: 'Admin User',
      roleName: 'admin',
    },
    {
      email: 'academicofficer@gmail.com',
      username: 'academic_officer',
      password: await hashPassword('a123456'),
      fullName: 'Academic Officer User',
      roleName: 'academic_officer',
    },
    {
      email: 'thesismanager@gmail.com',
      username: 'graduation_thesis_manager',
      password: await hashPassword('a123456'),
      fullName: 'Graduation Thesis Manager User',
      roleName: 'graduation_thesis_manager',
    },
    {
      email: 'examinationofficer@gmail.com',
      username: 'examination_officer',
      password: await hashPassword('a123456'),
      fullName: 'Examination Officer User',
      roleName: 'examination_officer',
    },
  ];

  for (const user of defaultUsers) {
    const role = await prisma.role.findUnique({ where: { name: user.roleName } });
    if (!role) throw new Error(`Role ${user.roleName} not found`);
    if (!role.isSystemWide) continue; // Bỏ qua nếu không phải vai trò toàn hệ thống

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

//hoangleuleu  @github.com
// Tạo người dùng mặc định cho sinh viên và giảng viên
// Tạo người dùng mặc định cho sinh viên và giảng viên


async function main() {
  console.log('Seeding database...');
  await createRoles();
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