import express from 'express';
import { startCronJobs } from './utils/cron-job';
import morgan from 'morgan';
import cors from 'cors';
import { config } from 'dotenv';
import userRouter from './routers/user.router';
import adminRouter from './routers/admin.router';
import importStudentRouter from './routers/importStudent.router';
import studentRouter from './routers/student.router';
import yearRouter from './routers/year.route';
import semesterRouter from './routers/semester.route';
import importConditionRouter from './routers/importCondition.router';
import exportRouter from './routers/export.router';
import groupRoutes from './routers/group.routes';
import meetingRouter from './routers/meeting.router';
import emailRouter from './routers/email.router';
import emailTemplateRouter from './routers/emailTemplate.router';
import importLecturer from './routers/imprortLecturer.router';
import majorRouter from './routers/major.router';
import systemConfigRoutes from './routers/system.config.routes';
import topicRoutes from './routers/topic.routes';
import submissionPeriodRoutes from './routers/submissionPeriod.routes';
import councilTopicRoutes from './routers/council.topic.routes';
import uploadRoutes from './routers/upload.routes';
import exportTopicRoutes from './routers/export-topic.routes';
import usersemesterroleRouter from './routers/user-semester-role.routes';
import importTopicRoutes from './routers/import-topic.routes';
import progressReportRouter from './routers/progress-report.router';
import councilReivewRotuer from './routers/council.review.routes';
import aiRouter from './routers/ai.router';
import statisticsRouter from './routers/statistics.router';
import councilDenfeseRotuer from './routers/council.defense.routes';
import decisionRoutes from './routers/decision.routes';
import thesisAssignmentDecisionRouter from './routers/thesisAssignmentDecision.router';

// Tải biến môi trường từ file .env
config();
//console.log('GOOGLE_GEMINI_API_KEY:', process.env.GOOGLE_GEMINI_API_KEY ? 'Đã tìm thấy API Key' : 'Không tìm thấy API Key');

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://final-capstone-project-git-main-anhphis-projects.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.options('*', cors());

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/import', importStudentRouter);
app.use('/api/student', studentRouter);
app.use('/api/year', yearRouter);
app.use('/api/semester', semesterRouter);
app.use('/api/import', importConditionRouter);
app.use('/api/export', exportRouter);
app.use('/api/groups', groupRoutes);
app.use('/api/meetings', meetingRouter);
app.use('/api', emailRouter);
app.use('/api/email-templates', emailTemplateRouter);
app.use('/api/import', importLecturer);
app.use('/api/majors', majorRouter);
app.use('/api/config', systemConfigRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/submission-periods', submissionPeriodRoutes);
app.use('/api/council-topic', councilTopicRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', exportTopicRoutes);
app.use('/api/semester-role', usersemesterroleRouter);
app.use('/api', importTopicRoutes);
app.use('/api/progress-report', progressReportRouter);
app.use('/api/council-review', councilReivewRotuer);
app.use('/api/ai', aiRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/council-defense', councilDenfeseRotuer);
app.use('/api', decisionRoutes);
app.use('/api', thesisAssignmentDecisionRouter);
// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startCronJobs();
});