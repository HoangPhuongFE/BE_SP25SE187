import { PrismaClient } from "@prisma/client";
import { paginate } from "~/helpers/pagination.helper";
const prisma = new PrismaClient();

export const getAllYearsService = async (page: number, pageSize: number) => {
  return await paginate(prisma.year, { page, pageSize }, { orderBy: { year: "asc" } });
};
export const createYearService = async (year: number) => {
  return await prisma.year.create({
    data: { year },
  });
};

export const updateYearService = async (id: string, year: number) => {
  return await prisma.year.update({
    where: { id },
    data: { year },
  });
};

export const deleteYearService = async (id: string) => {
  return await prisma.year.delete({
    where: { id },
  });
};
