export type AuthUser = {
  id: number;
  fullName: string;
  username: string;
};

export type AuthState = {
  authenticated: boolean;
  requiresSetup: boolean;
  user: AuthUser | null;
};

export type LoginDto = {
  username: string;
  password: string;
};

export type RegisterUserDto = {
  fullName: string;
  username: string;
  password: string;
};
