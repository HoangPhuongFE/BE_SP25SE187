import express from 'express';
import { startCronJobs } from "./utils/cron-job";
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
import emailTemplateRouter from "./routers/emailTemplate.router";
import importLecturer from './routers/imprortLecturer.router';
import majorRouter from './routers/major.router';
import systemConfigRoutes from "./routers/system.config.routes";
import councilRouter from './routers/council.router'
import importCouncilRoutes from "./routers/import-council.routes";
import topicRoutes from "./routers/topic.routes";
import submissionPeriodRoutes from './routers/submissionPeriod.routes';
import councilTopicRoutes from './routers/council.topic.routes';

//
config();
const app = express();

// Middleware CORS
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(morgan('dev'));  
app.use(express.json());

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
app.use("/api/email-templates", emailTemplateRouter);
app.use("/api/import", importLecturer);
app.use("/api/majors", majorRouter);
app.use("/api/config", systemConfigRoutes);
app.use('/api/councils', councilRouter);
app.use("/api/import-councils", importCouncilRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/submission-periods", submissionPeriodRoutes);
app.use('/api/council-topic', councilTopicRoutes);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startCronJobs();
});


