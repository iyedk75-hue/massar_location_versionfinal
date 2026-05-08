import { invokeCommand } from "@/services/invoke";
import type { AuthState, LoginDto, RegisterUserDto } from "@/types/auth";

export async function getAuthState() {
  return invokeCommand<AuthState>("get_auth_state");
}

export async function registerUser(data: RegisterUserDto) {
  return invokeCommand<AuthState>("register_user", { data });
}

export async function loginUser(data: LoginDto) {
  return invokeCommand<AuthState>("login_user", { data });
}

export async function logoutUser() {
  return invokeCommand<AuthState>("logout_user");
}
