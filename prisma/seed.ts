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
    { code: 'SPRING2025', startDate: new Date('2025-02-28'), endDate: new Date('2025-04-30'), status: 'ACTIVE', yearId: createdYears[2025] },
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
    { studentCode: 'SE168888', email: 'vanthinh1234vt@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end', status:'not qualified' },
    { studentCode: 'SE168822', email: 'lethu1234lt@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end',status:'not qualified' },
    { studentCode: 'SE162288', email: 'quynhtran1234tq@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE162828', email: 'quangnguyen1234nq@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Back-end' ,status:'qualified'},
    { studentCode: 'SE168228', email: 'nguyenanhthu7479@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-stack',status:'qualified' },
   
    { studentCode: 'SE174878', email: 'Ninhanh63628@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-end',status:'qualified' },
    { studentCode: 'SE187857', email: 'Lananh21682@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE155545', email: 'Hoaianh7162@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end',status:'qualified' },

    { studentCode: 'SE145982', email: 'phamanhloc8685@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end',status:'qualified' },
    { studentCode: 'SE141454', email: 'nguyenanhdung8605798@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end' ,status:'qualified'},
    { studentCode: 'SE141453', email: 'am4589653@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end' ,status:'qualified'},
    { studentCode: 'SE141452', email: 'anhm19791@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE141451', email: 'kim884784@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-stack',status:'qualified' },

    { studentCode: 'SE165555', email: 'toan2255661@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end' ,status:'qualified'},
    { studentCode: 'SE165556', email: 'tranduc1234htd@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN1', programming_language: 'Front-end' ,status:'qualified'},
    { studentCode: 'SE165458', email: 'thanhhuyen2009nth@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Front-end' ,status:'qualified'},
    { studentCode: 'SE165459', email: 'huytruong123nht@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Front-end',status:'qualified' },
    { studentCode: 'SE165960', email: 'quynhtrang098nqt@gmail.com', profession: 'Artificial Intelligence', specialty: 'CN2', programming_language: 'Full-stack' ,status:'qualified'},

    // SE students
    { studentCode: 'SE185695', email: 'macchien978@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end' ,status:'qualified'},
    { studentCode: 'SE189654', email: 'thihan11k@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end',status:'qualified' },
    { studentCode: 'SE189648', email: 'quanphan1kk@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Full-stack' ,status:'qualified'},
    { studentCode: 'SE184223', email: 'quynhhoa2281@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE189344', email: 'nguyencattuong7699@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end',status:'qualified' },

    { studentCode: 'SE156497', email: 'anhm05544@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Full-stack',status:'not qualified' },
    { studentCode: 'SE156975', email: 'manhhung1999nmh@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Full-stack' ,status:'qualified'},
    { studentCode: 'SE154973', email: 'hvu311333@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Full-stack' ,status:'qualified'},
    { studentCode: 'SE146499', email: 'vuh041247@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE144957', email: 'hoangvuu225577@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Back-end' ,status:'qualified'},

    { studentCode: 'SE166797', email: 'heolylom194@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end' ,status:'not qualified'},
    { studentCode: 'SE166749', email: 'zonduyen25@gmail.com', profession: 'Software Engineering', specialty: '.Net', programming_language: 'Front-end' ,status:'qualified'},
    { studentCode: 'SE166666', email: 'hoamgnguyen8@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE166947', email: 'huuduy.nguyen169@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end' ,status:'qualified'},

    { studentCode: 'SE134697', email: 'Anhthu183966@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Back-end',status:'qualified' },
    { studentCode: 'SE194794', email: 'Ngocchi417@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Full-end',status:'qualified' },
    { studentCode: 'SE194244', email: 'trandat456777@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end',status:'qualified' },
    { studentCode: 'SE164244', email: 'phatpham198311@gmail.com', profession: 'Software Engineering', specialty: 'Nodejs', programming_language: 'Front-end',status:'qualified' },
      // 

  ];





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
        roles: {
          create: {
            roleId: (await (async () => {
              const role = await prisma.role.findFirst({ where: { name: 'student' } });
              if (!role) throw new Error('Role "student" not found');
              return role.id;
            })()),
            isActive: true,
          },
        },
      },
    });
  
    // Kiểm tra nếu sinh viên đã tồn tại
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
      where: { semesterId_studentId: { semesterId: semester.id, studentId: studentEntry.id } },
      update: {},
      create: {
        semesterId: semester.id,
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
