import type { UserRole, UserStatus, AgentRank } from "../models/userModel";

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  phone?: string;
  avatar?: string;
  address?: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isActive: boolean;
  agentRank?: AgentRank;
  businessName?: string;
  city?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  permissions?: string[];
}

export interface AdminData {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  phone?: string;
  role: UserRole.ADMIN | UserRole.SUPER_ADMIN;
  permissions: string[];
}

export interface UserFilter {
  role?: string;
  status?: string;
  search?: string;
  verified?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminFilter {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserStats {
  total: number;
  byRole: {
    buyers: number;
    agents: number;
    admins: number;
  };
  byVerification: {
    verified: number;
    unverified: number;
  };
  byStatus: {
    active: number;
    inactive: number;
  };
  newUsersLast30Days: number;
  monthlyRegistrations: number[];
}

export interface ApiResponse<T> {
  status: string;
  data: T;
  results?: number;
  pagination?: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}
