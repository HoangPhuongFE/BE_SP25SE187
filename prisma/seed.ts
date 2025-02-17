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
    {
      email: 'mentor00@gmail.com',
      username: 'mentor00',
      password: await hashPassword('a123456'),
      fullName: 'Mentor User',
      roleName: 'mentor',
    },
    {
      email: 'mentor11@gmail.com',
      username: 'mentor11',
      password: await hashPassword('a123456'),
      fullName: 'Mentor User11',
      roleName: 'mentor',
    },
    {
      email: 'lecturer@gmail.com',
      username: 'lecturer',
      password: await hashPassword('a123456'),
      fullName: 'Lecturer User',
      roleName: 'lecturer',
    },
    {
      email: 'admin@gmail.com',
      username: 'admin',
      password: await hashPassword('a123456'),
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
async function createStudents() {

  const semester = await prisma.semester.findFirst({ where: { code: 'SPRING2025' } });
  if (!semester) throw new Error('SPRING2025 semester not found'); 
  const studentsData = [
    // AI students 
    { studentCode: 'SE161446', email: 'buiquanghuy532002@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Back-end' },
    { studentCode: 'SE161447', email: 'buiquanghuy532003@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Back-end' },
    { studentCode: 'SE161448', email: 'buiquanghuy532004@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Back-end' },
    { studentCode: 'SE161449', email: 'buiquanghuy532005@gmail.com', profession: 'AI', specialty: 'CN2', programming_language: 'Back-end' },
    { studentCode: 'SE161450', email: 'buiquanghuy532006@gmail.com', profession: 'AI', specialty: 'CN2', programming_language: 'Full-stack' },
    
    { studentCode: 'SE161455', email: 'buiquanghuy532007@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Front-end' },
    { studentCode: 'SE161454', email: 'buiquanghuy532008@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Back-end' },
    { studentCode: 'SE161453', email: 'buiquanghuy532009@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Back-end' },
    { studentCode: 'SE161452', email: 'buiquanghuy532010@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Back-end' },
    { studentCode: 'SE161451', email: 'buiquanghuy532011@gmail.com', profession: 'AI', specialty: 'CN2', programming_language: 'Full-stack' },

    { studentCode: 'SE161456', email: 'buiquanghuy5320012@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Front-end' },
    { studentCode: 'SE161457', email: 'buiquanghuy5320013@gmail.com', profession: 'AI', specialty: 'CN1', programming_language: 'Front-end' },
    { studentCode: 'SE161458', email: 'buiquanghuy5320014@gmail.com', profession: 'AI', specialty: 'CN2', programming_language: 'Front-end' },
    { studentCode: 'SE161459', email: 'buiquanghuy5320150@gmail.com', profession: 'AI', specialty: 'CN2', programming_language: 'Front-end' },
    { studentCode: 'SE161460', email: 'buiquanghuy5320116@gmail.com', profession: 'AI', specialty: 'CN2', programming_language: 'Full-stack' },

    // SE students 
    { studentCode: 'SE161480', email: 'hoamgnguyen101@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Front-end' },
    { studentCode: 'SE161481', email: 'hoamgnguyen105@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Front-end' },
    { studentCode: 'SE161482', email: 'hoamgnguyen104@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Full-stack' },
    { studentCode: 'SE161483', email: 'hoamgnguyen107@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Back-end' },
    { studentCode: 'SE161484', email: 'hoamgnguyen108@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Back-end' },

    { studentCode: 'SE161471', email: 'hoamgnguyen10@gmail.com', profession: 'SE', specialty: '.Net', programming_language: 'Full-stack' },
    { studentCode: 'SE161472', email: 'hoamgnguyen11@gmail.com', profession: 'SE', specialty: '.Net', programming_language: 'Full-stack' },
    { studentCode: 'SE161473', email: 'hoamgnguyen12@gmail.com', profession: 'SE', specialty: '.Net', programming_language: 'Full-stack' },
    { studentCode: 'SE161474', email: 'hoamgnguyen13@gmail.com', profession: 'SE', specialty: '.Net', programming_language: 'Back-end' },
    { studentCode: 'SE161475', email: 'hoamgnguyen14@gmail.com', profession: 'SE', specialty: '.Net', programming_language: 'Back-end' },

    { studentCode: 'SE161476', email: 'hoamgnguyen15@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Front-end' },
    { studentCode: 'SE161479', email: 'hoamgnguyen18@gmail.com', profession: 'SE', specialty: '.Net', programming_language: 'Front-end' },
    { studentCode: 'SE161491', email: 'hoangnguyenhoang8@yahoo.com', profession: 'AI', specialty: '.CN2', programming_language: 'Back-end' },
    { studentCode: 'SE161492', email: 'hoangnpse161446@fpt.edu.vn', profession: 'SE', specialty: '.Net', programming_language: 'Front-end' },
    { studentCode: 'SE161493', email: 'huuduy.nguyen169@gmail.com', profession: 'SE', specialty: 'Nodejs', programming_language: 'Back-end' },
    { studentCode: 'SE161494', email: 'huybqse161436@fpt.edu.vn', profession: 'SE', specialty: 'Nodejs', programming_language: 'Front-end' }
  ];

  for (const student of studentsData) {
    const major = await prisma.major.upsert({
      where: { name: student.profession },
      update: {},
      create: { name: student.profession },
    });

    const specialization = await prisma.specialization.upsert({
      where: { id: `${student.specialty}-${major.id}` },
      update: {},
      create: { name: student.specialty, majorId: major.id },
    });

    const hashedPassword = await hashPassword('a123456');

    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {},
      create: {
        email: student.email,
        username: student.email.split('@')[0],
        passwordHash: hashedPassword,
        student_code: student.studentCode,
        profession: student.profession,
        specialty: student.specialty,
        programming_language: student.programming_language,
      },
    });

    const studentEntry = await prisma.student.upsert({
      where: { studentCode: student.studentCode },
      update: {},
      create: {
        userId: user.id,
        studentCode: student.studentCode,
        majorId: major.id,
        specializationId: specialization.id,
        importSource: 'seed',
      },
    });

    await prisma.semesterStudent.upsert({
      where: { semesterId_studentId: { semesterId: semester.id, studentId: studentEntry.id } }, 
      update: {},
      create: { semesterId: semester.id, studentId: studentEntry.id }, 
    });
}




}

async function main() {
  console.log('Seeding database...');
  await createRoles();
  await createDefaultUsers();
  await createYearsAndSemesters();
  await createStudents();
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
