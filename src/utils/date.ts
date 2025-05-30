import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Kích hoạt plugin
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Trả về ngày giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 * @returns Date đối tượng chuẩn giờ VN
 */
export const nowVN = (): Date => {
  // Lấy thời gian hiện tại theo múi giờ UTC
  const rawTime = dayjs().utc();
 // console.log("Raw dayjs time (UTC):", rawTime.toISOString());

  // Cộng thêm 7 tiếng để chuyển sang múi giờ Asia/Ho_Chi_Minh (UTC+7)
  const vnTime = rawTime.add(7, "hour");
 // console.log("VN time:", vnTime.toISOString());

  // Trả về đối tượng Date
  const date = vnTime.toDate();
  //console.log("Final Date object:", date.toISOString());
  return date;
};