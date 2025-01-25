interface PaginationParams {
  page: number;
  pageSize: number;
}

interface PaginatedResult<T> {
  data: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

export async function paginate<T>(
  model: any, 
  { page, pageSize }: PaginationParams,
  options: Record<string, any> = {} 
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  // Lấy tổng số bản ghi
  const totalItems = await model.count({ where: options.where || {} });

  // Lấy dữ liệu phân trang
  const data = await model.findMany({
    skip,
    take,
    ...options,
  });

  return {
    data,
    currentPage: page,
    totalPages: Math.ceil(totalItems / pageSize),
    totalItems,
    pageSize,
  };
}
