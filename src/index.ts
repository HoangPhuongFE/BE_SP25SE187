import express from "express";
import { envConfig } from "./constants/config";
import userRouter from "./routers/user.router";
import { config } from 'dotenv';
import adminRouter from './routers/admin.router';
import importStudentRouter from './routers/importStudent.router';
import  student  from "./routers/student.router";
config();

const app = express();

app.use(express.json());

// Routes
app.use('/api/users', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/import', importStudentRouter);
app.use('/api/student', student);













app.listen(envConfig.PORT, () => {
  console.log(`Server is running on port ${envConfig.PORT}`);
});
