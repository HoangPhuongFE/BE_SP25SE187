import express from "express";
import { envConfig } from "./constants/config";
const app = express();

app.get("/", () => {
  console.log("hello world");
});

app.listen(envConfig.PORT, () => {
  console.log(envConfig);
  console.log(`Server is running in port  ${envConfig.PORT}`);
});
