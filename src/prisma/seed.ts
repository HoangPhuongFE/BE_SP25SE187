import { PrismaClient } from '@prisma/client';
import { UserService } from '../service/user.service';

const prisma = new PrismaClient();
const userService = new UserService();

async function main() {
  // Tạo các roles
  const roles = [
    { name: 'student', description: 'Sinh viên' },
    { name: 'lecturer', description: 'Giảng viên' },
    { name: 'head_of_department', description: 'Trưởng bộ môn' },
    { name: 'dean', description: 'Trưởng khoa' },
    { name: 'reviewer', description: 'Người phản biện' },
    { name: 'mentor', description: 'Người hướng dẫn' },
    { name: 'chairman', description: 'Chủ tịch hội đồng' },
    { name: 'secretary', description: 'Thư ký hội đồng' }
  ];

  for (const role of roles) {
    await prisma.role.create({
      data: role
    });
  }

  // Tạo các user mặc định
  await userService.createDefaultUsers();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 