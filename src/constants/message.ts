// Thông báo liên quan đến nhóm
export const GROUP_MESSAGE = {
  GROUP_CREATED: "Group created successfully",
  GROUP_NOT_FOUND: "Group not found",
  GROUP_FULL: "Group is already full",
  MEMBER_ALREADY_EXISTS: "Student is already in the group",
  INVITATION_SENT: "Invitation sent successfully",
  INVITATION_EXISTS: "Invitation already sent",
  INVITATION_NOT_FOUND: "Invitation not found",
  INVITATION_ACCEPTED: "Invitation accepted successfully",
  INVITATION_REJECTED: "Invitation rejected successfully",
} as const;

// Thông báo liên quan đến Email
export const EMAIL_MESSAGE = {
  EMAIL_SENT: "Email sent successfully",
  EMAIL_FAILED: "Failed to send email",
} as const;


// Thông báo dành cho người dùng
export const USER_MESSAGE = {
  VALIDATION_ERROR: "Validation errors",
  USER_NOT_FOUND: "User not found",
  INVALID_PASSWORD: "Invalid password",
  INVALID_TOKEN: "Invalid token",
  EMAIL_EXISTS: "Email already exists",
  USERNAME_EXISTS: "Username already exists",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Forbidden access",
  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  UPDATE_PROFILE_SUCCESS: "Profile updated successfully",
  USER_ALREADY_EXISTS: "User already exists",
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
  SEMESTER_CREATED: "Semester created successfully",
  SEMESTER_UPDATED: "Semester updated successfully",
  SEMESTER_DELETED: "Semester deleted successfully",
  SEMESTER_NOT_FOUND: "Semester not found",
  SEMESTER_STUDENTS_FETCHED: "Students for semester fetched successfully",
  INVALID_SEMESTER_ID: "Invalid semester ID provided",
  SEMESTERS_FETCHED: "Semesters fetched successfully",
  SEMESTER_FETCHED: "Semester fetched successfully",
  SEMESTER_DETAIL_FETCHED: "Semester detail fetched successfully",
  SEMESTER_DETAIL_NOT_FOUND: "Semester detail not found",
} as const;

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
  ACTION_SUCCESS: "Action completed successfully",
  ACTION_FAILED: "Action failed",
  SERVER_ERROR: "Internal server error",
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
  TOPIC_CREATED: "Topic created successfully",
  TOPIC_UPDATED: "Topic updated successfully",
  TOPIC_DELETED: "Topic deleted successfully",
  TOPIC_NOT_FOUND: "Topic not found",
  TOPIC_REGISTRATION_UPDATED: "Topic registration updated successfully",
  TOPIC_REGISTRATION_NOT_FOUND: "Topic registration not found",
  INVALID_STATUS: "Status is invalid",
  INVALID_REVIEWER: "Reviewer is invalid",
  DUPLICATE_TOPIC_CODE: "Topic code already exists",
  INVALID_MAJOR: "Major is invalid",
  SEMESTER_REQUIRED: "Semester is required",
  INVALID_BUSINESS_INFO: "Business info is invalid",
  MAX_STUDENTS_INVALID: "Number of students is invalid",
  DESCRIPTION_REQUIRED: "Description is required",
  NAME_REQUIRED: "Name is required",
  MENTOR_MAX_TOPICS_REACHED: "Mentor has reached the maximum limit of 5 topics",
  MENTOR_NO_BUSINESS_TOPICS: "Mentor cannot register a business topic",
  LEADER_NO_BUSINESS_TOPICS: "Leader cannot register a business topic",
  GROUP_ALREADY_HAS_TOPIC: "Group already has a topic",
  TOPIC_REGISTRATION_CREATED: "Topic registration created successfully",
  TOPICS_FETCHED: "Topics fetched successfully",
  STUDENT_CANNOT_UPDATE: "Student cannot update topic when it is not rejected",
  UNAUTHORIZED_UPDATE: "Unauthorized update",
  AI_VALIDATION_FAILED: "AI validation failed: ",
  INVALID_TOPIC_NAME: "Invalid topic name: ",
  INVALID_TOPIC_CODE: "Invalid topic code: ",
  TOPIC_FETCHED: "Topic fetched",
  INVALID_ID: "Invalid topic ID",
  TOPIC_IN_USE: "Cannot delete topic in use",
  UNAUTHORIZED: "Unauthorized access",
  MISSING_STATUS: "Status is required",
  UPDATE_STATUS_SUCCESS: "Topic status updated successfully",
  UPDATE_STATUS_FAILED: "Failed to update topic status",
  TOPIC_STATUS_UPDATED: "Topic status updated successfully",
  TOPIC_STATUS_UPDATE_FAILED: "Failed to update topic status",
  GET_TOPICS_SUCCESS: "Topics fetched successfully",
  GET_TOPICS_FAILED: "Failed to fetch topics",
  TOPIC_STATUS: {
    DRAFT: 'DRAFT',           // Đề tài đang trong trạng thái nháp
    PENDING: 'PENDING',       // Đề tài đang chờ duyệt
    APPROVED: 'APPROVED',     // Đề tài đã được phê duyệt
    REJECTED: 'REJECTED',     // Đề tài bị từ chối
    CONSIDER: 'CONSIDER',     // Đề tài cần xem xét lại
    IN_PROGRESS: 'IN_PROGRESS', // Đề tài đang được thực hiện
    COMPLETED: 'COMPLETED',   // Đề tài đã hoàn thành
    CANCELLED: 'CANCELLED'    // Đề tài đã bị hủy
  },
  CANNOT_UPDATE_STATUS: "Cannot update topic status",
  STATUS_TRANSITION_INVALID: "Status transition is invalid",
} as const;


export const MEETING_MESSAGE = {
  MEETING_CREATED: "Meeting created successfully",
  MEETING_UPDATED: "Meeting updated successfully",
  MEETING_DELETED: "Meeting deleted successfully",
  MEETING_NOT_FOUND: "Meeting not found",
  UNAUTHORIZED_MENTOR: "You are not the mentor of this group",
  INVALID_MEETING_TIME: "Invalid meeting time",
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
  CANNOT_DELETE_HAS_REGISTRATIONS: "Không thể xóa khoảng thời gian có đăng ký đề tài",
  CANNOT_CREATE_IN_PAST: "Không thể tạo khoảng thời gian trong quá khứ",
  FETCHED: "Lấy danh sách khoảng thời gian nộp đề tài thành công",
} as const;

export const REVIEW_COUNCIL_MESSAGE = {
  CREATED: "Hội đồng duyệt đề tài đã được tạo thành công",
  UPDATED: "Hội đồng duyệt đề tài đã được cập nhật thành công",
  DELETED: "Hội đồng duyệt đề tài đã được xóa thành công",
  NOT_FOUND: "Không tìm thấy hội đồng duyệt đề tài",
  MEMBER_ADDED: "Thành viên đã được thêm vào hội đồng duyệt đề tài",
  MEMBER_REMOVED: "Thành viên đã được xóa khỏi hội đồng duyệt đề tài",
  MEMBER_ALREADY_EXISTS: "Thành viên đã tồn tại trong hội đồng duyệt đề tài",
  PRIMARY_REVIEWER_ASSIGNED: "Đã gán người đánh giá chính cho hội đồng duyệt đề tài",
  EVALUATIONS_IMPORTED: "Đã nhập kết quả đánh giá đề tài thành công",
  INVALID_EVALUATION_FORMAT: "Định dạng file đánh giá không hợp lệ",
  UNAUTHORIZED: "Bạn không có quyền thực hiện hành động này",
  COUNCIL_TYPES: {
    TOPIC_REVIEW: "TOPIC_REVIEW",
    PROGRESS_REVIEW: "PROGRESS_REVIEW",
    DEFENSE: "DEFENSE"
  },
  STATUS: {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED"
  },
  FETCHED: "Lấy danh sách hội đồng duyệt đề tài thành công",
  DETAIL_FETCHED: "Lấy chi tiết hội đồng duyệt đề tài thành công"
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
  REVIEW_COUNCIL: REVIEW_COUNCIL_MESSAGE,
} as const;