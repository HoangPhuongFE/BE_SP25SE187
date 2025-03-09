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
  LOGIN_SUCCESS: "Login successful",
  REGISTER_SUCCESS: "Registration successful",
  LOGOUT_SUCCESS: "Logout successful",
  GOOGLE_LOGIN_FAILED: "Google login failed",
} as const;

// Thông báo cho quản trị viên
export const ADMIN_MESSAGE = {
  CREATE_USER_SUCCESS: "User created successfully",
  DELETE_USER_SUCCESS: "User deleted successfully",
  UPDATE_USER_SUCCESS: "User updated successfully",
  UPDATE_ROLES_SUCCESS: "User roles updated successfully",
  INVALID_ROLE: "One or more roles are invalid",
  EMAIL_EXISTS: "Email already exists",
  USERNAME_EXISTS: "Username already exists",
  USER_NOT_FOUND: "User not found",
  MISSING_FIELDS: "User ID and roles are required",
  STUDENT_ROLE_RESTRICTION: "User with the role 'student' cannot have additional roles",
} as const;

// Thông báo liên quan đến xử lý dữ liệu
export const DATA_MESSAGE = {
  IMPORT_SUCCESS: "Data imported successfully",
  IMPORT_FAILED: "Data import failed",
  INVALID_FILE_FORMAT: "Invalid file format",
  DUPLICATE_ENTRY: "Duplicate data detected",
  MISSING_REQUIRED_FIELDS: "Missing required fields in the file",
  STUDENT_ALREADY_EXISTS: "Student already exists in the system",
  USER_ALREADY_EXISTS: "User already exists in the system",
  MISSING_SEMESTER: "Select semester before importing",
  NO_STUDENTS_FOUND: "No students found for the selected semester",
  UNAUTHORIZED: 'Unauthorized access',

} as const;

// Thông báo cho nhật ký hệ thống
export const SYSTEM_LOG_MESSAGE = {
  LOG_CREATED: "System log entry created",
  LOG_UPDATED: "System log entry updated",
  LOG_DELETED: "System log entry deleted",
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
  COUNCIL_CREATED: "Tạo hội đồng thành công",
  COUNCIL_CREATION_FAILED: "Tạo hội đồng thất bại",
  COUNCIL_NOT_FOUND: "Không tìm thấy hội đồng",
  COUNCIL_UPDATED: "Cập nhật hội đồng thành công",
  COUNCIL_DELETED: "Xóa hội đồng thành công",
  COUNCIL_DELETE_FAILED: "Không thể xóa hội đồng, vui lòng thử lại",
  COUNCIL_MEMBERS_ADDED: "Thêm thành viên vào hội đồng thành công",
  COUNCIL_MEMBERS_FAILED: "Thêm thành viên vào hội đồng thất bại",
  COUNCIL_LIST_FETCHED: "Lấy danh sách hội đồng thành công",
  COUNCIL_LIST_FAILED: "Lấy danh sách hội đồng thất bại",
  LECTURERS_ROLES_FETCHED: "Lấy danh sách giảng viên và vai trò thành công",
  LECTURERS_ROLES_FAILED: "Không thể lấy danh sách giảng viên và vai trò",
  INVALID_SEMESTER_ID: "ID học kỳ không hợp lệ",
  COUNCIL_MEMBER_REMOVED: "Xóa thành viên khỏi hội đồng thành công",
  COUNCIL_MEMBER_REMOVE_FAILED: "Không thể xóa thành viên khỏi hội đồng",
  COUNCIL_MEMBER_NOT_FOUND: "Không tìm thấy thành viên trong hội đồng",
  INVALID_REQUEST: "Yêu cầu không hợp lệ",
  MIN_MEMBERS_REQUIRED: "Không thể xóa, số lượng thành viên còn lại không đủ theo quy định",
  MAX_MEMBERS_EXCEEDED: "Số lượng thành viên vượt quá quy định",
  CHAIRMAN_LIMIT: "Số lượng chủ tịch vượt quá giới hạn",
  SECRETARY_LIMIT: "Số lượng thư ký vượt quá giới hạn",
  REVIEWER_LIMIT: "Số lượng reviewer vượt quá giới hạn",
  MEMBER_ALREADY_EXISTS: "Thành viên đã có trong hội đồng",
  USER_NOT_FOUND: "Người dùng không tồn tại trong hệ thống",
  EMAIL_REQUIRED: "Email không hợp lệ hoặc chưa được cung cấp",
  USER_ADDED_BY_EMAIL: "Thành viên đã được thêm vào hội đồng bằng Email",
  USER_ADDED_BY_ID: "Thành viên đã được thêm vào hội đồng bằng ID",
  COUNCIL_STATUS_UPDATED: "Trạng thái hội đồng đã được cập nhật",
  COUNCIL_UPDATE_FAILED: "Không thể cập nhật trạng thái hội đồng",
  COUNCIL_FETCHED: "Lấy thông tin hội đồng thành công",
} as const;

export default COUNCIL_MESSAGE;

// Thông báo cho sinh viên
export const STUDENT_MESSAGE = {
  STUDENT_NOT_FOUND: "Student not found",
  STUDENT_ADDED: "Student added successfully",
  STUDENT_UPDATED: "Student information updated successfully",
  STUDENT_DELETED: "Student removed successfully",
  STUDENTS_FETCHED: "Students fetched successfully",
  STUDENT_LIST_EMPTY: "No students found for the selected semester",
} as const;

// Thông báo chung
export const GENERAL_MESSAGE = {
  ACTION_SUCCESS: "Thao tác thành công",
  ACTION_FAILED: "Thao tác thất bại",
  SERVER_ERROR: "Lỗi máy chủ nội bộ",
} as const;

export const EXPORT_MESSAGE = {
  EXPORT_SUCCESS: "Export completed successfully.",
  EXPORT_FAILED: "Failed to export the data.",
  NO_DATA_FOUND: "No data found for the selected semester.",
} as const;

export const YEAR_MESSAGE = {
  YEAR_CREATED: "Year created successfully",
  YEAR_UPDATED: "Year updated successfully",
  YEAR_DELETED: "Year deleted successfully",
  YEAR_NOT_FOUND: "Year not found",
  YEAR_FETCHED: "Years fetched successfully",
};

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
  MEETING_CREATED: "Meeting created successfully",
  MEETING_UPDATED: "Meeting updated successfully",
  MEETING_DELETED: "Meeting deleted successfully",
  MEETING_NOT_FOUND: "Meeting not found",
  UNAUTHORIZED_MENTOR: "You are not the mentor of this group",
  INVALID_MEETING_TIME: "Invalid meeting time",
  INVALID_MEETING_URL: "Invalid meeting URL",
  GROUP_NOT_FOUND: "Group not found",
  DELETE_TIME_EXPIRED: "Cannot delete meeting before 1 day of the meeting",
  UPDATE_TIME_EXPIRED: "Cannot update meeting before 1 day of the meeting",
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
} as const;