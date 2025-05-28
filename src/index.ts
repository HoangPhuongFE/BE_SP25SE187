import express from 'express';
import { startCronJobs } from './utils/cron-job';
import morgan from 'morgan';
import cors from 'cors';
import { config } from 'dotenv';
import userRouter from './routers/user.router';
import adminRouter from './routers/admin.router';
import importStudentRouter from './routers/importStudent.router';
import studentRouter from './routers/student.router';
import yearRouter from './routers/year.router';
import semesterRouter from './routers/semester.router';
import importConditionRouter from './routers/importCondition.router';
import exportRouter from './routers/export.conditions.students.router';
import groupRouter from './routers/group.router';
import meetingRouter from './routers/meeting.router';
import emailRouter from './routers/email.router';
import emailTemplateRouter from './routers/email.template.router';
import importLecturer from './routers/imprortLecturer.router';
import majorRouter from './routers/major.router';
import systemConfigRouter from './routers/system.config.router';
import topicRouter from './routers/topic.router';
import submissionPeriodRouter from './routers/submissionPeriod.router';
import councilTopicRouter from './routers/council.topic.router';
import uploadRouter from './routers/upload.router';
import exportTopicRouter from './routers/export-topic.router';
import importTopicRouter from './routers/import-topic.router';
import progressReportRouter from './routers/progress-report.router';
import councilReivewRotuer from './routers/council.review.router';
import aiRouter from './routers/ai.router';
import councilDenfeseRotuer from './routers/council.defense.router';
import decisionRouter from './routers/decision.router';
import businessTopicRouter from './routers/business.topic.router';
import importBlock3Router from './routers/importBlock3.router';
import staticRoutes from "./routers/statistics.route";
import interMajorConfigRouter from './routers/interMajorConfig.router';
import interMajorGroupRouter from './routers/interMajorGroup.router';
import interMajorTopicRouter from './routers/interMajorTopic.router';
import thesisAssignmentRouter from './routers/thesisAssignment.router';
import { errorHandler } from './middleware/errorHandler';

config();

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
app.use('/api/groups', groupRouter);
app.use('/api/meetings', meetingRouter);
app.use('/api', emailRouter);
app.use('/api', emailTemplateRouter);
app.use('/api/import', importLecturer);
app.use('/api/majors', majorRouter);
app.use('/api/config', systemConfigRouter);
app.use('/api/topics', topicRouter);
app.use('/api/submission-periods', submissionPeriodRouter);
app.use('/api/council-topic', councilTopicRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', exportTopicRouter);
app.use('/api', importTopicRouter);
app.use('/api/progress-report', progressReportRouter);
app.use('/api/council-review', councilReivewRotuer);
app.use('/api/ai', aiRouter);
app.use('/api/council-defense', councilDenfeseRotuer);
app.use('/api', decisionRouter);
app.use('/api/business/topics', businessTopicRouter);
app.use('/api', importBlock3Router);
app.use('/api/statistics', staticRoutes); 
app.use('/api', interMajorConfigRouter);
app.use('/api', interMajorGroupRouter);
app.use('/api', interMajorTopicRouter);
app.use('/api', thesisAssignmentRouter);
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startCronJobs();
});

app.use(errorHandler);