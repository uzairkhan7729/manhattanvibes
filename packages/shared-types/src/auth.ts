export type Role =
  | 'SuperAdmin'
  | 'BranchManager'
  | 'Cashier'
  | 'KitchenStaff'
  | 'Driver'
  | 'Marketing'
  | 'Customer';

export interface JwtClaims {
  sub: string;        // user id
  role: Role;
  branchIds: string[];
  tenantId: string;
  jti: string;        // JWT id (matches refresh family on issue)
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // seconds
}

export interface LoginRequest {
  identifier: string; // email OR phone in E.164
  password: string;
}

export interface OtpRequestPayload {
  phone: string;      // E.164
  purpose: 'login' | 'register' | 'verify' | 'reset';
}

export interface OtpVerifyPayload {
  phone: string;
  code: string;
  purpose: 'login' | 'register' | 'verify' | 'reset';
}
