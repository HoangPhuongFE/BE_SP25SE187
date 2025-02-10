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
} as const;