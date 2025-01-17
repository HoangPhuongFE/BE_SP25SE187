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
  CREATE_USER_SUCCESS: 'User created successfully',
  UPDATE_ROLES_SUCCESS: 'User roles updated successfully',
  INVALID_ROLE: 'One or more roles are invalid',
  EMAIL_EXISTS: 'Email already exists',
  USERNAME_EXISTS: 'Username already exists',
  USER_NOT_FOUND: 'User not found',
  MISSING_FIELDS: 'User ID and roles are required',
  STUDENT_ROLE_RESTRICTION: 'User with the role student cannot have additional roles', 
} as const;
