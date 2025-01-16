import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear existing roles first
  await prisma.role.deleteMany();
  
  const roles = [
    { id: 'student-role-id', name: 'student', description: 'Sinh viên' },
    { id: 'lecturer-role-id', name: 'lecturer', description: 'Giảng viên' },
    { id: 'head-of-department-role-id', name: 'head_of_department', description: 'Trưởng bộ môn' },
    { id: 'dean-role-id', name: 'dean', description: 'Trưởng khoa' },
    { id: 'reviewer-role-id', name: 'reviewer', description: 'Người phản biện' },
    { id: 'mentor-role-id', name: 'mentor', description: 'Người hướng dẫn' },
    { id: 'chairman-role-id', name: 'chairman', description: 'Chủ tịch hội đồng' },
    { id: 'secretary-role-id', name: 'secretary', description: 'Thư ký hội đồng' },
  ];

  for (const role of roles) {
    await prisma.role.create({
      data: role,
    });
    console.log(`Created role: ${role.name}`);
  }
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });