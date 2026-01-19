/**
 * AiTer Authentication Types
 *
 * 用户认证相关的类型定义
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * 用户计划等级
 */
export type UserPlan = 'free' | 'pro' | 'enterprise'

/**
 * 用户信息
 */
export interface User {
  /** 用户唯一 ID */
  id: string

  /** 用户名 */
  username: string

  /** 邮箱 */
  email: string

  /** 显示名称 */
  displayName: string

  /** 头像 URL */
  avatar?: string

  /** 计划等级 */
  plan: UserPlan

  /** 所属组织 */
  organization?: string

  /** 创建时间 */
  createdAt?: string

  /** 最后登录时间 */
  lastLoginAt?: string
}

// ============================================================================
// Token Types
// ============================================================================

/**
 * 认证令牌
 */
export interface AuthTokens {
  /** 访问令牌 (JWT) */
  accessToken: string

  /** 刷新令牌 */
  refreshToken: string

  /** 访问令牌过期时间 (Unix timestamp) */
  expiresAt: number
}

// ============================================================================
// Auth Store
// ============================================================================

/**
 * 认证存储数据
 */
export interface AuthStoreData {
  /** 是否已登录 */
  isLoggedIn: boolean

  /** 用户信息 */
  user?: User

  /** 认证令牌 */
  tokens?: AuthTokens

  /** 上次配置同步时间 */
  lastConfigSync?: number

  /** 当前应用的配置版本 */
  configVersion?: string

  /** 设备 ID */
  deviceId?: string
}

// ============================================================================
// API Types
// ============================================================================

/**
 * 登录请求
 */
export interface LoginRequest {
  /** 用户名或邮箱 */
  username: string

  /** 密码 (客户端哈希后) */
  password: string

  /** 设备 ID */
  deviceId: string

  /** 客户端版本 */
  clientVersion: string

  /** 记住登录 */
  rememberMe?: boolean
}

/**
 * 登录响应
 */
export interface LoginResponse {
  success: boolean
  data?: {
    user: User
    tokens: {
      accessToken: string
      refreshToken: string
      expiresIn: number  // 秒
    }
    config?: import('./initConfig').AiTerInitConfig
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * Token 刷新请求
 */
export interface RefreshTokenRequest {
  refreshToken: string
}

/**
 * Token 刷新响应
 */
export interface RefreshTokenResponse {
  success: boolean
  data?: {
    accessToken: string
    expiresIn: number
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * 登出请求
 */
export interface LogoutRequest {
  /** 是否从所有设备登出 */
  allDevices?: boolean
}

// ============================================================================
// Auth Status
// ============================================================================

/**
 * 认证状态
 */
export type AuthStatus =
  | 'logged-out'      // 未登录
  | 'logging-in'      // 登录中
  | 'logged-in'       // 已登录
  | 'refreshing'      // 刷新 Token 中
  | 'expired'         // Token 已过期
  | 'error'           // 认证错误

/**
 * 认证状态信息
 */
export interface AuthStatusInfo {
  status: AuthStatus
  user?: User
  error?: string
  expiresAt?: number
}

// ============================================================================
// Events
// ============================================================================

/**
 * 认证事件类型
 */
export type AuthEventType =
  | 'logged-in'
  | 'logged-out'
  | 'token-refreshed'
  | 'session-expired'
  | 'auth-error'

/**
 * 认证事件数据
 */
export interface AuthEvent {
  type: AuthEventType
  user?: User
  error?: string
  timestamp: number
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * 认证错误代码
 */
export enum AuthErrorCode {
  /** 无效的凭证 */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  /** 用户不存在 */
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  /** 账户被锁定 */
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  /** Token 过期 */
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  /** Token 无效 */
  TOKEN_INVALID = 'TOKEN_INVALID',

  /** 刷新 Token 过期 */
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',

  /** 网络错误 */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** 服务器错误 */
  SERVER_ERROR = 'SERVER_ERROR',

  /** 未知错误 */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
