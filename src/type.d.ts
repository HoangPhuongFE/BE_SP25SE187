interface LoginDTO {
  email: string;
  password: string;
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
  roles: string[];
}

interface GoogleLoginDTO {
  idToken: string;
}
