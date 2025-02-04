import { PrismaClient } from "@prisma/client";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export const getSemestersByYearService = async (
  yearId: string, // CHUYỂN SANG STRING
  page: number,
  pageSize: number
) => {
  return await paginate(prisma.semester, { page, pageSize }, { where: { yearId } });
};

export const createSemesterService = async (
  yearId: string, // CHUYỂN SANG STRING
  code: string,
  startDate: Date,
  endDate: Date,
  registrationDeadline: Date,
  status: string
) => {
  return await prisma.semester.create({
    data: {
      yearId, // string
      code,
      startDate,
      endDate,
      registrationDeadline,
      status,
    },
  });
};

export const updateSemesterService = async (
  id: string, // CHUYỂN SANG STRING
  code: string,
  startDate: Date,
  endDate: Date,
  registrationDeadline: Date,
  status: string
) => {
  return await prisma.semester.update({
    where: { id }, // string
    data: {
      code,
      startDate,
      endDate,
      registrationDeadline,
      status,
    },
  });
};

export const deleteSemesterService = async (id: string) => {
  return await prisma.semester.delete({
    where: { id }, // string
  });
};
