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

export const AUTH_MESSAGE = {
  LOGIN_SUCCESS: "Login successful",
  REGISTER_SUCCESS: "Registration successful",
  LOGOUT_SUCCESS: "Logout successful",
  GOOGLE_LOGIN_FAILED: "Google login failed",
} as const;

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

export const DATA_MESSAGE = {
  IMPORT_SUCCESS: "Data imported successfully",
  IMPORT_FAILED: "Data import failed",
  INVALID_FILE_FORMAT: "Invalid file format",
  DUPLICATE_ENTRY: "Duplicate data detected",
  MISSING_REQUIRED_FIELDS: "Missing required fields in the file",
  STUDENT_ALREADY_EXISTS: "Student already exists in the system",
  USER_ALREADY_EXISTS: "User already exists in the system",
} as const;


export const SYSTEM_LOG_MESSAGE = {
  LOG_CREATED: "System log entry created",
  LOG_UPDATED: "System log entry updated",
  LOG_DELETED: "System log entry deleted",
} as const;

export const SEMESTER_MESSAGE = {
  SEMESTER_CREATED: "Semester created successfully",
  SEMESTER_UPDATED: "Semester updated successfully",
  SEMESTER_DELETED: "Semester deleted successfully",
  SEMESTER_NOT_FOUND: "Semester not found",
  INVALID_SEMESTER_DATE: "Invalid semester dates provided",
} as const;

export const STUDENT_MESSAGE = {
  STUDENT_NOT_FOUND: "Student not found",
  STUDENT_ADDED: "Student added successfully",
  STUDENT_UPDATED: "Student information updated successfully",
  STUDENT_DELETED: "Student removed successfully",
} as const;

export const GENERAL_MESSAGE = {
  ACTION_SUCCESS: "Action completed successfully",
  ACTION_FAILED: "Action failed",
  SERVER_ERROR: "Internal server error",
} as const;
