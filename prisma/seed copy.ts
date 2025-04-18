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

async function createYearsAndSemesters() {
  await prisma.semester.deleteMany();
  await prisma.year.deleteMany();

  const years = [{ year: 2025 }];
  const createdYears: { [key: number]: string } = {};

  for (const year of years) {
    const createdYear = await prisma.year.create({ data: year });
    createdYears[year.year] = createdYear.id;
    console.log(`Created year: ${year.year} with ID: ${createdYear.id}`);
  }

  const semesters = [
    { code: 'SPRING2025', startDate: new Date('2025-04-12'), endDate: new Date('2025-08-30'), status: 'UPCOMING', yearId: createdYears[2025] },
  ];

  for (const semester of semesters) {
    await prisma.semester.create({ data: semester });
    console.log(`Created semester: ${semester.code} for year ${semester.yearId}`);
  }

  const spring2025 = await prisma.semester.findFirst({ where: { code: 'SPRING2025' } });
  return { spring2025Id: spring2025?.id };
}

async function createStudents(semesterId: string) {
  // Xóa dữ liệu cũ trong bảng Student và SemesterStudent
  await prisma.semesterStudent.deleteMany();
  await prisma.student.deleteMany();

  const studentsData = [
    // AI students
    { studentCode: 'SE168888', email: 'vanthinh1234vt@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'not qualified' },
    { studentCode: 'SE168822', email: 'lethu1234lt@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'not qualified' },
    { studentCode: 'SE162288', email: 'quynhtran1234tq@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE162828', email: 'quangnguyen1234nq@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE168228', email: 'nguyenanhthu7479@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-stack', status: 'qualified' },
    { studentCode: 'SE174878', email: 'Ninhanh63628@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-end', status: 'qualified' },
    { studentCode: 'SE187857', email: 'Lananh21682@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE155545', email: 'Hoaianh7162@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE145982', email: 'phamanhloc8685@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE141454', email: 'nguyenanhdung8605798@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE141453', email: 'am4589653@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE141452', email: 'anhm19791@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE141451', email: 'kim884784@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-stack', status: 'qualified' },
    { studentCode: 'SE165555', email: 'toan2255661@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE165556', email: 'tranduc1234htd@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE165458', email: 'thanhhuyen2009nth@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE165459', email: 'huytruong123nht@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE165960', email: 'quynhtrang098nqt@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-stack', status: 'qualified' },
    // SE students
    { studentCode: 'SE185695', email: 'macchien978@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE189654', email: 'thihan11k@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE189648', email: 'quanphan1kk@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Full-stack', status: 'qualified' },
    { studentCode: 'SE184223', email: 'quynhhoa2281@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE189344', email: 'nguyencattuong7699@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE156497', email: 'anhm05544@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Full-stack', status: 'not qualified' },
    { studentCode: 'SE156975', email: 'manhhung1999nmh@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Full-stack', status: 'qualified' },
    { studentCode: 'SE154973', email: 'hvu311333@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Full-stack', status: 'qualified' },
    { studentCode: 'SE146499', email: 'vuh041247@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE144957', email: 'hoangvuu225577@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE166797', email: 'heolylom194@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end', status: 'not qualified' },
    { studentCode: 'SE166749', email: 'zonduyen25@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE166666', email: 'hoamgnguyen8@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE166947', email: 'huuduy.nguyen169@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE134697', email: 'Anhthu183966@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end', status: 'qualified' },
    { studentCode: 'SE194794', email: 'Ngocchi417@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Full-end', status: 'qualified' },
    { studentCode: 'SE194244', email: 'trandat456777@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end', status: 'qualified' },
    { studentCode: 'SE164244', email: 'phatpham198311@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end', status: 'qualified' },
  ];

  const studentRole = await prisma.role.findUnique({ where: { name: 'student' } });
  if (!studentRole) throw new Error('Student role not found');
  const studentRoleId = studentRole.id;

  for (const student of studentsData) {
    const major = await prisma.major.upsert({
      where: { name: student.profession },
      update: {},
      create: { name: student.profession },
    });

    const specialization = await prisma.specialization.upsert({
      where: { id: `${student.specialty}_${major.id}` },
      update: {},
      create: { name: student.specialty, majorId: major.id },
    });

    const hashedPassword = await hashPassword('a123456');

    // Tìm người dùng dựa trên email

    let user = await prisma.user.findFirst({
      where: { email: student.email },
    });

    // Nếu không tìm thấy, tạo người dùng mới
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: student.email,
          username: student.email.split('@')[0],
          passwordHash: hashedPassword,
          student_code: student.studentCode,
          profession: student.profession,
          specialty: student.specialty,
          programming_language: student.programming_language,
          roles: {
            create: {
              roleId: studentRoleId,
              semesterId,
              isActive: true,
            },
          },
        },
      });
    }

    let studentEntry = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!studentEntry) {
      studentEntry = await prisma.student.create({
        data: {
          userId: user.id,
          studentCode: student.studentCode,
          majorId: major.id,
          specializationId: specialization.id,
          importSource: 'seed',
        },
      });
    }

    const isEligible = student.status === 'qualified';

    await prisma.semesterStudent.upsert({
      where: { semesterId_studentId: { semesterId: semesterId, studentId: studentEntry.id } },
      update: {},
      create: {
        semesterId: semesterId,
        studentId: studentEntry.id,
        isEligible,
        qualificationStatus: isEligible ? 'qualified' : 'not qualified',
      },
    });
  }
}

async function main() {
  console.log('Seeding database...');
  await createRoles();
  const { spring2025Id } = await createYearsAndSemesters();
  if (!spring2025Id) throw new Error('Failed to get SPRING2025 semester ID');
  await createDefaultUsers();
  await createStudents(spring2025Id);
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