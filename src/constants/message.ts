export const USER_MESSAGE = {
  VALIDATION_ERROR: "validation errors",
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
  INVALID_ROLE: "Invalid role",
  STUDENT_ROLE_RESTRICTION: "Cannot assign another role to a student account",
  ADMIN_REQUIRED: "Admin rights required",
} as const;
