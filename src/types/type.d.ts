import { TokenPayload } from '../interfaces/auth.interface'; 

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}



interface LoginDTO {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterDTO {
  email: string;
  password: string;
  username: string;
  fullName?: string;
}

interface TokenPayload {
  userId: string;
  email: string;
  roles: {
    [x: string]: unknown;
    roleId: string;
    semesterId: string | null; // Cho phép null
    isActive: boolean;
    isSystemWide: boolean; // Thêm thuộc tính này nếu cần
  }[];
}


interface GoogleLoginDTO {
  idToken: string;
}

interface ChangePasswordDTO {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ForgotPasswordDTO {
  email: string;
}
interface ResetPasswordDTO {
  email: string;
  newPassword: string;
  confirmationCode: string;
}
