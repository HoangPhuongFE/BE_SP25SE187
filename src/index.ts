import express from "express";
import { envConfig } from "./constants/config";
import userRouter from "./routers/user.router";
import { config } from 'dotenv';
config();

const app = express();

app.use(express.json());

// Routes
app.use('/api/users', userRouter);

app.listen(envConfig.PORT, () => {
  console.log(`Server is running on port ${envConfig.PORT}`);
});
