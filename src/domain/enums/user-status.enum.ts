/**
 * User Status Enum
 * 
 * Defines the possible states of a user account
 */

export enum UserStatus {
  /** User registered but not yet verified */
  PENDING = 'pending',

  /** User is active and verified */
  ACTIVE = 'active',

  /** User account is suspended */
  SUSPENDED = 'suspended',

  /** User account is deactivated */
  INACTIVE = 'inactive',
}

/**
 * User Role Enum
 * 
 * Defines user authorization levels
 */
export enum UserRole {
  /** Regular user */
  USER = 'user',

  /** Administrator with elevated privileges */
  ADMIN = 'admin',

  /** Super admin with full access */
  SUPER_ADMIN = 'super_admin',
}

/**
 * Device Type Enum
 * 
 * Defines the types of devices users can access the platform from
 */
export enum DeviceType {
  /** Android mobile device */
  ANDROID = 'android',

  /** iOS mobile device (iPhone/iPad) */
  IOS = 'ios',

  /** Web browser (desktop/mobile) */
  WEB = 'web',
}

/**
 * Social Login Provider Enum
 * 
 * Defines the authentication providers supported by the platform
 */
export enum SocialLoginProvider {
  /** Email/password authentication */
  EMAIL = 'email',

  /** Google OAuth authentication */
  GOOGLE = 'google',

  /** Apple Sign In authentication */
  APPLE = 'apple',

  /** Facebook OAuth authentication */
  FACEBOOK = 'facebook',
}

/**
 * Learn Level Enum
 * 
 * Defines the user's educational level
 */
export enum LearnLevel {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  COLLEGE = 'college',
}

/**
 * Theme Enum
 * 
 * Defines the user's preferred UI theme
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}
