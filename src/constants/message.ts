// Thông báo liên quan đến nhóm
export const GROUP_MESSAGE = {
  GROUP_CREATED: "Tạo nhóm thành công",
  GROUP_NOT_FOUND: "Không tìm thấy nhóm",
  GROUP_FULL: "Nhóm đã đủ thành viên",
  MEMBER_ALREADY_EXISTS: "Sinh viên này đã có trong nhóm",

  INVITATION_SENT: "Đã gửi lời mời",
  INVITATION_EXISTS: "Lời mời đã được gửi trước đó",
  INVITATION_NOT_FOUND: "Không tìm thấy lời mời",
  INVITATION_ACCEPTED: "Chấp nhận lời mời thành công",
  INVITATION_REJECTED: "Từ chối lời mời thành công",
  INVALID_REQUEST: "Yêu cầu không hợp lệ, vui lòng kiểm tra lại dữ liệu đầu vào.",
  INVITATION_FAILED: "Gửi lời mời thất bại",
  INVITATION_RESPONSE_FAILED: "Không thể xử lý phản hồi lời mời, vui lòng thử lại.",

  STUDENT_NOT_FOUND: "Không tìm thấy sinh viên.",
  STUDENT_NOT_IN_SEMESTER: "Sinh viên chưa đăng ký học kỳ này hoặc danh sách điều kiện chưa được nhập.",
  STUDENT_NOT_QUALIFIED: "Sinh viên chưa đủ điều kiện tham gia nhóm.",

  GROUP_CODE_GENERATED: "Mã nhóm được tạo thành công.",
  MAX_GROUP_MEMBERS_REACHED: "Số lượng thành viên nhóm đã đạt giới hạn.",
  GROUP_CREATION_FAILED: "Tạo nhóm thất bại.",
  NO_PERMISSION_INVITE: "Bạn không có quyền mời thành viên vào nhóm.",
  GROUP_LOCKED: "Nhóm đã bị khóa. Không thể gửi lời mời.",
  GROUP_MAJOR_MISMATCH: "Sinh viên thuộc ngành khác, không thể tham gia nhóm.",
  GROUP_ALREADY_CREATED: "Nhóm đã được tạo trước đó.",
} as const;


// Thông báo liên quan đến Email
export const EMAIL_MESSAGE = {
  EMAIL_SENT: "Email đã được gửi thành công.",
  EMAIL_FAILED: "Gửi email thất bại.",
} as const;


// Thông báo dành cho người dùng
export const USER_MESSAGE = {
  VALIDATION_ERROR: "Lỗi xác thực đầu vào",
  USER_NOT_FOUND: "Không tìm thấy người dùng",
  INVALID_PASSWORD: "Mật khẩu không chính xác",
  INVALID_TOKEN: "Token không hợp lệ",
  EMAIL_EXISTS: "Email đã tồn tại",
  USERNAME_EXISTS: "Tên đăng nhập đã tồn tại",
  UNAUTHORIZED: "Không được phép truy cập",
  FORBIDDEN: "Truy cập bị cấm",
  INVALID_REFRESH_TOKEN: "Refresh token không hợp lệ",
  UPDATE_PROFILE_SUCCESS: "Cập nhật hồ sơ thành công",
  USER_ALREADY_EXISTS: "Người dùng đã tồn tại",

} as const;

// Thông báo liên quan đến xác thực
export const AUTH_MESSAGE = {
  LOGIN_SUCCESS: "Đăng nhập thành công",
  REGISTER_SUCCESS: "Đăng ký tài khoản thành công",
  LOGOUT_SUCCESS: "Đăng xuất thành công",
  GOOGLE_LOGIN_FAILED: "Đăng nhập bằng Google thất bại",
} as const;

// Thông báo cho quản trị viên
export const ADMIN_MESSAGE = {
  CREATE_USER_SUCCESS: "Tạo người dùng thành công",
  DELETE_USER_SUCCESS: "Xóa người dùng thành công",
  UPDATE_USER_SUCCESS: "Cập nhật người dùng thành công",
  UPDATE_ROLES_SUCCESS: "Cập nhật vai trò người dùng thành công",
  INVALID_ROLE: "Vai trò không hợp lệ",
  EMAIL_EXISTS: "Email đã tồn tại",
  USERNAME_EXISTS: "Tên đăng nhập đã tồn tại",
  USER_NOT_FOUND: "Không tìm thấy người dùng",
  MISSING_FIELDS: "Yêu cầu có ID người dùng và vai trò",
  STUDENT_ROLE_RESTRICTION: "Người dùng có vai trò 'sinh viên' không được có thêm vai trò khác",
} as const;

// Thông báo liên quan đến xử lý dữ liệu
export const DATA_MESSAGE = {
  IMPORT_SUCCESS: "Nhập dữ liệu thành công",
  IMPORT_FAILED: "Nhập dữ liệu thất bại",
  INVALID_FILE_FORMAT: "Định dạng tệp không hợp lệ",
  DUPLICATE_ENTRY: "Phát hiện dữ liệu trùng lặp",
  MISSING_REQUIRED_FIELDS: "Thiếu các trường bắt buộc trong tệp",
  STUDENT_ALREADY_EXISTS: "Sinh viên đã tồn tại trong hệ thống",
  USER_ALREADY_EXISTS: "Người dùng đã tồn tại trong hệ thống",
  MISSING_SEMESTER: "Vui lòng chọn học kỳ trước khi nhập dữ liệu",
  NO_STUDENTS_FOUND: "Không tìm thấy sinh viên trong học kỳ đã chọn",
  UNAUTHORIZED: "Truy cập không được phép",
} as const;

// Thông báo cho nhật ký hệ thống
export const SYSTEM_LOG_MESSAGE = {
  LOG_CREATED: "Đã tạo bản ghi nhật ký hệ thống",
  LOG_UPDATED: "Đã cập nhật bản ghi nhật ký hệ thống",
  LOG_DELETED: "Đã xóa bản ghi nhật ký hệ thống",
} as const;


// Thông báo liên quan đến học kỳ
export const SEMESTER_MESSAGE = {
  SEMESTER_CREATED: "Tạo học kỳ thành công",
  SEMESTER_UPDATED: "Cập nhật học kỳ thành công",
  SEMESTER_DELETED: "Xoá học kỳ thành công",
  SEMESTER_NOT_FOUND: "Không tìm thấy học kỳ",
  SEMESTER_STUDENTS_FETCHED: "Đã lấy danh sách sinh viên cho học kỳ",
  INVALID_SEMESTER_ID: "ID học kỳ không hợp lệ",
  SEMESTERS_FETCHED: "Lấy danh sách học kỳ thành công",
  SEMESTER_FETCHED: "Lấy học kỳ thành công",
  SEMESTER_DETAIL_FETCHED: "Lấy chi tiết học kỳ thành công",
  SEMESTER_DETAIL_NOT_FOUND: "Không tìm thấy chi tiết học kỳ"
} as const;

//  
export const COUNCIL_MESSAGE = {
  // Create
  COUNCIL_CREATED: "Tạo hội đồng thành công",
  COUNCIL_CREATION_FAILED: "Tạo hội đồng thất bại",
  CREATED: "Tạo hội đồng thành công",
  CREATE_FAILED: "Tạo hội đồng thất bại",

  // Read
  COUNCIL_NOT_FOUND: "Không tìm thấy hội đồng",
  NOT_FOUND: "Không tìm thấy hội đồng",
  GET_FAILED: "Lấy thông tin hội đồng thất bại",
  LIST_FAILED: "Lấy danh sách hội đồng thất bại",
  COUNCIL_LIST_FAILED: "Lấy danh sách hội đồng thất bại",
  COUNCIL_LIST_FETCHED: "Lấy danh sách hội đồng thành công",

  // Update
  COUNCIL_UPDATED: "Cập nhật hội đồng thành công",
  UPDATED: "Cập nhật hội đồng thành công",
  UPDATE_FAILED: "Cập nhật hội đồng thất bại",
  COUNCIL_UPDATE_FAILED: "Không thể cập nhật trạng thái hội đồng",

  // Delete
  COUNCIL_DELETED: "Xóa hội đồng thành công",
  DELETED: "Xóa hội đồng thành công",
  DELETE_FAILED: "Xóa hội đồng thất bại",
  COUNCIL_DELETE_FAILED: "Không thể xóa hội đồng",

  // Member
  MEMBER_ADDED: "Thêm thành viên thành công",
  MEMBER_ADD_FAILED: "Thêm thành viên thất bại",
  MEMBER_REMOVED: "Xóa thành viên thành công",
  MEMBER_REMOVE_FAILED: "Xóa thành viên thất bại",
  MEMBER_NOT_FOUND: "Không tìm thấy thành viên",
  MEMBER_EXISTS: "Thành viên đã tồn tại trong hội đồng",

  // Validation
  INVALID_LECTURER: "Người dùng không phải là giảng viên",
  INVALID_DATE_RANGE: "Thời gian không hợp lệ",
  SUBMISSION_PERIOD_NOT_FOUND: "Không tìm thấy đợt đề xuất",

  // Success
  COUNCIL_FETCHED: "Lấy thông tin hội đồng thành công",
  COUNCIL_GET_FAILED: "Lấy thông tin hội đồng thất bại"
} as const;

export default COUNCIL_MESSAGE;

// Thông báo cho sinh viên
export const STUDENT_MESSAGE = {
  STUDENT_NOT_FOUND: "Không tìm thấy sinh viên",
  STUDENT_ADDED: "Thêm sinh viên thành công",
  STUDENT_UPDATED: "Cập nhật thông tin sinh viên thành công",
  STUDENT_DELETED: "Xóa sinh viên thành công",
  STUDENTS_FETCHED: "Lấy danh sách sinh viên thành công",
  STUDENT_LIST_EMPTY: "Không có sinh viên trong học kỳ đã chọn",
} as const;

export const EXPORT_MESSAGE = {
  EXPORT_SUCCESS: "Xuất dữ liệu thành công",
  EXPORT_FAILED: "Xuất dữ liệu thất bại",
  NO_DATA_FOUND: "Không có dữ liệu trong học kỳ đã chọn",
} as const;

export const YEAR_MESSAGE = {
  YEAR_CREATED: "Tạo năm học thành công",
  YEAR_UPDATED: "Cập nhật năm học thành công",
  YEAR_DELETED: "Xóa năm học thành công",
  YEAR_NOT_FOUND: "Không tìm thấy năm học",
  YEAR_FETCHED: "Lấy danh sách năm học thành công",
} as const;

// Thông báo chung
export const GENERAL_MESSAGE = {
  ACTION_SUCCESS: "Thao tác thành công",
  ACTION_FAILED: "Thao tác thất bại",
  SERVER_ERROR: "Lỗi máy chủ nội bộ",
} as const;
export const TOPIC_MESSAGE = {
  TOPIC_CREATED: "Tạo đề tài thành công",
  TOPIC_UPDATED: "Cập nhật đề tài thành công",
  TOPIC_DELETED: "Xóa đề tài thành công",
  TOPIC_NOT_FOUND: "Không tìm thấy đề tài",
  TOPIC_CREATION_FAILED: "Tạo đề tài thất bại", 
  TOPIC_REGISTRATION_UPDATED: "Cập nhật đăng ký đề tài thành công",
  TOPIC_REGISTRATION_NOT_FOUND: "Không tìm thấy đăng ký đề tài",
  INVALID_STATUS: "Trạng thái không hợp lệ",
  INVALID_REVIEWER: "Người đánh giá không hợp lệ",
  DUPLICATE_TOPIC_CODE: "Mã đề tài đã tồn tại",
  INVALID_MAJOR: "Ngành học không hợp lệ",
  SEMESTER_REQUIRED: "Học kỳ là bắt buộc",
  INVALID_BUSINESS_INFO: "Thông tin doanh nghiệp không hợp lệ",
  MAX_STUDENTS_INVALID: "Số lượng sinh viên không hợp lệ",
  DESCRIPTION_REQUIRED: "Mô tả đề tài là bắt buộc",
  NAME_REQUIRED: "Tên đề tài là bắt buộc",
  MENTOR_MAX_TOPICS_REACHED: "Giảng viên đã đạt giới hạn tối đa 5 đề tài",
  MENTOR_NO_BUSINESS_TOPICS: "Giảng viên không thể đăng ký đề tài doanh nghiệp",
  LEADER_NO_BUSINESS_TOPICS: "Trưởng nhóm không thể đăng ký đề tài doanh nghiệp",
  GROUP_ALREADY_HAS_TOPIC: "Nhóm đã có đề tài",
  TOPIC_REGISTRATION_CREATED: "Đăng ký đề tài thành công",
  TOPICS_FETCHED: "Lấy danh sách đề tài thành công",
  STUDENT_CANNOT_UPDATE: "Sinh viên không thể cập nhật đề tài khi chưa bị từ chối",
  UNAUTHORIZED_UPDATE: "Không có quyền cập nhật",
  AI_VALIDATION_FAILED: "Kiểm tra AI thất bại: ",
  INVALID_TOPIC_NAME: "Tên đề tài không hợp lệ: ",
  INVALID_TOPIC_CODE: "Mã đề tài không hợp lệ: ",
  TOPIC_FETCHED: "Lấy thông tin đề tài thành công",
  INVALID_ID: "ID đề tài không hợp lệ",
  TOPIC_IN_USE: "Không thể xóa đề tài đang được sử dụng",
  UNAUTHORIZED: "Không có quyền truy cập",
  MISSING_STATUS: "Trạng thái là bắt buộc",
  UPDATE_STATUS_SUCCESS: "Cập nhật trạng thái đề tài thành công",
  UPDATE_STATUS_FAILED: "Cập nhật trạng thái đề tài thất bại",
  TOPIC_STATUS_UPDATED: "Trạng thái đề tài đã được cập nhật",
  TOPIC_STATUS_UPDATE_FAILED: "Không thể cập nhật trạng thái đề tài",
  GET_TOPICS_SUCCESS: "Lấy danh sách đề tài thành công",
  GET_TOPICS_FAILED: "Không thể lấy danh sách đề tài",
  CANNOT_UPDATE_STATUS: "Không thể cập nhật trạng thái đề tài",
  STATUS_TRANSITION_INVALID: "Chuyển đổi trạng thái không hợp lệ",
  INVALID_REQUEST : "Yêu cầu không hợp lệ",
  ACTION_FAILED: "Thao tác thất bại",
} as const;



export const MEETING_MESSAGE = {
  MEETING_CREATED: "Tạo buổi họp thành công",
  MEETING_UPDATED: "Cập nhật buổi họp thành công",
  MEETING_DELETED: "Xóa buổi họp thành công",
  MEETING_NOT_FOUND: "Không tìm thấy buổi họp",
  UNAUTHORIZED_MENTOR: "Bạn không phải là giảng viên hướng dẫn của nhóm này",
  INVALID_MEETING_TIME: "Thời gian họp không hợp lệ",
  INVALID_MEETING_URL: "Liên kết họp không hợp lệ",
  GROUP_NOT_FOUND: "Không tìm thấy nhóm",
  DELETE_TIME_EXPIRED: "Không thể xóa buổi họp trước 1 ngày diễn ra",
  UPDATE_TIME_EXPIRED: "Không thể cập nhật buổi họp trước 1 ngày diễn ra",
} as const;

export const TOPIC_SUBMISSION_PERIOD_MESSAGE = {
  CREATED: "Khoảng thời gian nộp đề tài đã được tạo thành công",
  UPDATED: "Khoảng thời gian nộp đề tài đã được cập nhật thành công",
  DELETED: "Khoảng thời gian nộp đề tài đã được xóa thành công",
  NOT_FOUND: "Không tìm thấy khoảng thời gian nộp đề tài",
  INVALID_DATE_RANGE: "Khoảng thời gian không hợp lệ",
  OVERLAPPED_PERIOD: "Khoảng thời gian bị trùng lặp với khoảng thời gian khác",
  INVALID_SEMESTER: "Học kỳ không hợp lệ",
  INVALID_ROUND: "Số thứ tự đợt nộp không hợp lệ",
  STATUS: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    COMPLETED: "COMPLETED"
  },
  CANNOT_UPDATE_COMPLETED: "Không thể cập nhật khoảng thời gian đã kết thúc",
  CANNOT_DELETE_ACTIVE: "Không thể xóa khoảng thời gian đang hoạt động",
  CANNOT_CREATE_IN_PAST: "Không thể tạo khoảng thời gian trong quá khứ",
  FETCHED: "Lấy danh sách khoảng thời gian nộp đề tài thành công",
} as const;

// Thông báo liên quan đến MSGV (Mã số giảng viên)
export const MSGV_MESSAGE = {
  MSGV_NOT_FOUND: "Không tìm thấy mã số giảng viên.",
  MSGV_DUPLICATE: "Mã số giảng viên đã tồn tại trong hệ thống.",
  MSGV_INVALID: "Mã số giảng viên không hợp lệ.",
  MSGV_UPDATED: "Cập nhật mã số giảng viên thành công.",
  MSGV_ASSIGNMENT_FAILED: "Gán mã số giảng viên thất bại.",
} as const;

//  Thông báo liên quan đến quá trình Import dữ liệu
export const IMPORT_MESSAGE = {
  IMPORT_SUCCESS: "Import dữ liệu thành công.",
  IMPORT_FAILED: "Import dữ liệu thất bại.",
  IMPORT_PARTIALLY_FAILED: "Một số dòng bị lỗi trong quá trình import.",
  IMPORT_DUPLICATE_FOUND: "Có dữ liệu trùng lặp trong file import.",
  IMPORT_INVALID_FILE_FORMAT: "File không đúng định dạng.",
  IMPORT_MISSING_REQUIRED_FIELDS: "File thiếu thông tin bắt buộc.",
  IMPORT_ROW_ERROR: (rowNumber: number, error: string) => `Lỗi tại dòng ${rowNumber}: ${error}`,
} as const;

//  Thông báo liên quan đến Database
export const DATABASE_MESSAGE = {
  DUPLICATE_ENTRY: "Dữ liệu bị trùng lặp trong hệ thống.",
  RECORD_NOT_FOUND: "Không tìm thấy bản ghi trong hệ thống.",
  UNAUTHORIZED_ACCESS: "Bạn không có quyền thực hiện thao tác này.",
  DATABASE_ERROR: "Lỗi hệ thống cơ sở dữ liệu.",
} as const;

export const PROGRESS_REPORT_MESSAGE = {
  REPORT_CREATED: "Tạo báo cáo tiến độ thành công",
  REPORT_UPDATED: "Cập nhật báo cáo tiến độ thành công",
  REPORT_DELETED: "Xóa báo cáo tiến độ thành công",
  REPORT_NOT_FOUND: "Không tìm thấy báo cáo tiến độ",
  FEEDBACK_ADDED: "Thêm phản hồi thành công",
  FEEDBACK_UPDATED: "Cập nhật phản hồi thành công",
  UNAUTHORIZED: "Bạn không có quyền gửi báo cáo tiến độ cho nhóm này",
  INVALID_REQUEST: "Yêu cầu không hợp lệ",
  GROUP_NOT_FOUND: "Không tìm thấy nhóm",
  MENTOR_NOT_FOUND: "Không tìm thấy mentor cho nhóm này",
  WEEK_REPORT_EXISTS: "Báo cáo tiến độ cho tuần này đã tồn tại",
  CANNOT_UPDATE_REVIEWED: "Không thể cập nhật báo cáo đã được đánh giá",
  REPORTS_FETCHED: "Lấy danh sách báo cáo tiến độ thành công",
  REPORT_FETCHED: "Lấy thông tin báo cáo tiến độ thành công",
  PERIOD_CREATED: "Tạo khoảng thời gian báo cáo tiến độ thành công",
  PERIODS_FETCHED: "Lấy danh sách khoảng thời gian báo cáo tiến độ thành công",
  INVALID_DATE_RANGE: "Khoảng thời gian không hợp lệ",
  WEEK_PERIOD_EXISTS: "Khoảng thời gian báo cáo cho tuần này đã tồn tại",
  NOT_MAIN_MENTOR: "Chỉ mentor chính mới có quyền tạo khoảng thời gian báo cáo",
  NO_ACTIVE_PERIOD: "Không có khoảng thời gian báo cáo nào đang hoạt động",
} as const;


// Cập nhật vào danh sách MESSAGES chung
export const MESSAGES = {
  STUDENT: STUDENT_MESSAGE,
  GENERAL: GENERAL_MESSAGE,
  USER: USER_MESSAGE,
  AUTH: AUTH_MESSAGE,
  ADMIN: ADMIN_MESSAGE,
  DATA: DATA_MESSAGE,
  SYSTEM_LOG: SYSTEM_LOG_MESSAGE,
  SEMESTER: SEMESTER_MESSAGE,
  YEAR: YEAR_MESSAGE,
  EXPORT: EXPORT_MESSAGE,
  GROUP: GROUP_MESSAGE, 
  EMAIL: EMAIL_MESSAGE,
  TOPIC: TOPIC_MESSAGE,
  MEETING: MEETING_MESSAGE,
  TOPIC_SUBMISSION_PERIOD: TOPIC_SUBMISSION_PERIOD_MESSAGE,
  COUNCIL_MESSAGE : COUNCIL_MESSAGE,
  MSGV: MSGV_MESSAGE, 
  IMPORT: IMPORT_MESSAGE, 
  DATABASE: DATABASE_MESSAGE,
  PROGRESS_REPORT: PROGRESS_REPORT_MESSAGE,
} as const;