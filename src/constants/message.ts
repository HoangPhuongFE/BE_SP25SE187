

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
  MISSING_SEMESTER: "Chọn học kỳ trước khi import",
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

export const YEAR_MESSAGE = {
  YEAR_CREATED: "Year created successfully",
  YEAR_UPDATED: "Year updated successfully",
  YEAR_DELETED: "Year deleted successfully",
  YEAR_NOT_FOUND: "Year not found",
  YEAR_FETCHED: "Years fetched successfully",
};

// Tập hợp các nhóm thông báo
export const MESSAGES = {
  STUDENT: STUDENT_MESSAGE,
  GENERAL: GENERAL_MESSAGE,
  USER: USER_MESSAGE,
  AUTH: AUTH_MESSAGE,
  ADMIN: ADMIN_MESSAGE,
  DATA: DATA_MESSAGE,
  SYSTEM_LOG: SYSTEM_LOG_MESSAGE,
  SEMESTER: SEMESTER_MESSAGE,
  YEAR : YEAR_MESSAGE,
} as const;