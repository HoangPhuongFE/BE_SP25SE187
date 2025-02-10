import express from "express";
import cors from 'cors';
import { envConfig } from "./constants/config";
import userRouter from "./routers/user.router";
import { config } from 'dotenv';
import adminRouter from './routers/admin.router';
import importStudentRouter from './routers/importStudent.router';
import  studentRouter  from "./routers/student.router";
import yearRouter from "./routers/year.route";
import semesterRouter from "./routers/semester.route";
import importConditionRouter from "./routers/importCondition.router";
import exportRotuer from "./routers/export.router";
import groupRoutes from "./routers/group.routes";
import topicRouter from "./routers/topic.router";
import meetingRouter from "./routers/meeting.router";

config();

const app = express();

// Thêm middleware CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/users', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/import', importStudentRouter);
app.use('/api/student', studentRouter);
app.use('/api/year', yearRouter);
app.use('/api/semester', semesterRouter);
app.use('/api/import', importConditionRouter);
app.use('/api/export', exportRotuer);
app.use("/api/groups", groupRoutes);
app.use("/api/topics", topicRouter);
app.use('/api/meetings', meetingRouter);

app.listen(envConfig.PORT, () => {
  console.log(`Server is running on port ${envConfig.PORT}`);
});
