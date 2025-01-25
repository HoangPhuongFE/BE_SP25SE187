import { PrismaClient } from "@prisma/client";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export const getSemestersByYearService = async (
    yearId: number,
    page: number,
    pageSize: number
  ) => {
    return await paginate(prisma.semester, { page, pageSize }, { where: { yearId } });
  };
  
export const createSemesterService = async (
  yearId: number,
  code: string,
  startDate: Date,
  endDate: Date,
  registrationDeadline: Date,
  status: string
) => {
  return await prisma.semester.create({
    data: {
      yearId,
      code,
      startDate,
      endDate,
      registrationDeadline,
      status,
    },
  });
};

export const updateSemesterService = async (
  id: number,
  code: string,
  startDate: Date,
  endDate: Date,
  registrationDeadline: Date,
  status: string
) => {
  return await prisma.semester.update({
    where: { id },
    data: {
      code,
      startDate,
      endDate,
      registrationDeadline,
      status,
    },
  });
};

export const deleteSemesterService = async (id: number) => {
  return await prisma.semester.delete({
    where: { id },
  });
};
