/**
 * Social Authentication Service
 * 
 * Handles social login (Google, Apple, Facebook) authentication.
 * Verifies tokens from social providers and creates/authenticates users.
 */

import { injectable, inject } from 'tsyringe';
import axios from 'axios';
import { UserRepository } from '@repositories/user.repository';
import { IUserDTO } from '@domain/interfaces/user.interface';
import { SocialLoginProvider, UserStatus, UserRole, DeviceType } from '@domain/enums/user-status.enum';
import { GoogleSigninInput, AppleSigninInput } from '@validations/social-auth.validation';
import { UnauthorizedError, BadRequestError } from '@utils/errors';
import { createChildLogger } from '@utils/logger';
import { generateTokenPair, TokenPair } from '@utils/jwt';
import { config } from '@config/index';

const socialAuthLogger = createChildLogger('social-auth-service');

/**
 * Google Token Info Response
 */
interface GoogleTokenInfo {
    iss: string;
    azp: string;
    aud: string;
    sub: string;
    email: string;
    email_verified: string;
    name?: string;
    picture?: string;
    given_name?: string;
    family_name?: string;
    locale?: string;
    iat: string;
    exp: string;
}

/**
 * Apple ID Token Payload (decoded JWT)
 */
interface AppleTokenPayload {
    iss: string;
    aud: string;
    exp: number;
    iat: number;
    sub: string;
    email?: string;
    email_verified?: string | boolean;
    is_private_email?: string | boolean;
    auth_time?: number;
    nonce_supported?: boolean;
}

/**
 * Social Auth Response with tokens
 */
export interface SocialAuthResponse {
    user: IUserDTO;
    tokens: TokenPair;
    isNewUser: boolean;
}

/**
 * Social Auth Service Interface
 */
export interface ISocialAuthService {
    googleSignin(data: GoogleSigninInput): Promise<SocialAuthResponse>;
    appleSignin(data: AppleSigninInput): Promise<SocialAuthResponse>;
}

/**
 * Social Auth Service Implementation
 */
@injectable()
export class SocialAuthService implements ISocialAuthService {
    constructor(
        @inject(UserRepository) private userRepository: UserRepository
    ) { }

    /**
     * Google Sign-in
     */
    async googleSignin(data: GoogleSigninInput): Promise<SocialAuthResponse> {
        socialAuthLogger.info('Google signin attempt');

        const googleUser = await this.verifyGoogleToken(data.idToken);
        if (!googleUser) {
            throw new UnauthorizedError('Invalid Google token');
        }

        socialAuthLogger.info('Google token verified', { email: googleUser.email, googleId: googleUser.sub });

        let user = await this.userRepository.findOne({
            socialLoginProvider: SocialLoginProvider.GOOGLE,
            socialLoginId: googleUser.sub,
        });

        let isNewUser = false;

        if (!user) {
            const existingEmailUser = await this.userRepository.findByEmailSafe(googleUser.email);

            if (existingEmailUser) {
                user = await this.userRepository.updateProfile(existingEmailUser._id.toString(), {
                    socialLoginProvider: SocialLoginProvider.GOOGLE,
                    socialLoginId: googleUser.sub,
                    emailVerifiedAt: new Date(),
                    status: UserStatus.ACTIVE,
                    profileImage: googleUser.picture || existingEmailUser.profileImage,
                });
            } else {
                isNewUser = true;
                user = await this.userRepository.createUser({
                    email: googleUser.email,
                    password: this.generateRandomPassword(),
                    firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
                    lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
                    role: UserRole.USER,
                    socialLoginProvider: SocialLoginProvider.GOOGLE,
                    socialLoginId: googleUser.sub,
                    profileImage: googleUser.picture,
                    deviceToken: data.deviceToken,
                    deviceType: data.deviceType as DeviceType | undefined,
                });

                await this.userRepository.updateProfile(user._id.toString(), {
                    emailVerifiedAt: new Date(),
                    status: UserStatus.ACTIVE,
                });

                user = await this.userRepository.findById(user._id.toString());
            }
        }

        if (!user) {
            throw new BadRequestError('Failed to create or retrieve user');
        }

        await this.userRepository.updateLastLoginAt(user._id.toString());

        if (data.deviceToken && data.deviceType) {
            await this.userRepository.updateProfile(user._id.toString(), {
                deviceToken: data.deviceToken,
                deviceType: data.deviceType as DeviceType,
            });
        }

        const tokens = generateTokenPair({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        socialAuthLogger.info('Google signin successful', { userId: user._id, isNewUser });

        return { user: user.toDTO(), tokens, isNewUser };
    }

    /**
     * Apple Sign-in
     */
    async appleSignin(data: AppleSigninInput): Promise<SocialAuthResponse> {
        socialAuthLogger.info('Apple signin attempt');

        const appleUser = await this.verifyAppleToken(data.identityToken);
        if (!appleUser) {
            throw new UnauthorizedError('Invalid Apple token');
        }

        socialAuthLogger.info('Apple token verified', { appleId: appleUser.sub, email: appleUser.email });

        let user = await this.userRepository.findOne({
            socialLoginProvider: SocialLoginProvider.APPLE,
            socialLoginId: appleUser.sub,
        });

        let isNewUser = false;

        if (!user) {
            const email = appleUser.email || data.user?.email;
            const userEmail = email || `apple_${appleUser.sub.substring(0, 10)}@privaterelay.appleid.com`;

            if (!email) {
                socialAuthLogger.warn('No email from Apple, using placeholder', { appleId: appleUser.sub });
            }

            const existingEmailUser = await this.userRepository.findByEmailSafe(userEmail);

            if (existingEmailUser) {
                user = await this.userRepository.updateProfile(existingEmailUser._id.toString(), {
                    socialLoginProvider: SocialLoginProvider.APPLE,
                    socialLoginId: appleUser.sub,
                    emailVerifiedAt: new Date(),
                    status: UserStatus.ACTIVE,
                });
            } else {
                isNewUser = true;
                const firstName = data.user?.name?.firstName || 'Apple';
                const lastName = data.user?.name?.lastName || 'User';

                user = await this.userRepository.createUser({
                    email: userEmail,
                    password: this.generateRandomPassword(),
                    firstName,
                    lastName,
                    role: UserRole.USER,
                    socialLoginProvider: SocialLoginProvider.APPLE,
                    socialLoginId: appleUser.sub,
                    deviceToken: data.deviceToken,
                    deviceType: data.deviceType as DeviceType | undefined,
                });

                await this.userRepository.updateProfile(user._id.toString(), {
                    emailVerifiedAt: new Date(),
                    status: UserStatus.ACTIVE,
                });

                user = await this.userRepository.findById(user._id.toString());
            }
        }

        if (!user) {
            throw new BadRequestError('Failed to create or retrieve user');
        }

        await this.userRepository.updateLastLoginAt(user._id.toString());

        if (data.deviceToken && data.deviceType) {
            await this.userRepository.updateProfile(user._id.toString(), {
                deviceToken: data.deviceToken,
                deviceType: data.deviceType as DeviceType,
            });
        }

        const tokens = generateTokenPair({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        socialAuthLogger.info('Apple signin successful', { userId: user._id, isNewUser });

        return { user: user.toDTO(), tokens, isNewUser };
    }

    /**
     * Verify Google ID Token
     */
    private async verifyGoogleToken(idToken: string): Promise<GoogleTokenInfo | null> {
        try {
            const response = await axios.get<GoogleTokenInfo>(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
                { timeout: 10000 }
            );

            const tokenInfo = response.data;

            if (config.google.clientId && tokenInfo.aud !== config.google.clientId) {
                socialAuthLogger.warn('Google token audience mismatch');
                return null;
            }

            if (tokenInfo.email_verified !== 'true') {
                socialAuthLogger.warn('Google email not verified');
                return null;
            }

            const expTime = parseInt(tokenInfo.exp) * 1000;
            if (Date.now() >= expTime) {
                socialAuthLogger.warn('Google token expired');
                return null;
            }

            return tokenInfo;
        } catch (error) {
            socialAuthLogger.error('Failed to verify Google token', error);
            return null;
        }
    }

    /**
     * Verify Apple Identity Token
     */
    private async verifyAppleToken(identityToken: string): Promise<AppleTokenPayload | null> {
        try {
            const parts = identityToken.split('.');
            if (parts.length !== 3 || !parts[1]) {
                socialAuthLogger.warn('Invalid Apple token format');
                return null;
            }

            const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
            const payload: AppleTokenPayload = JSON.parse(payloadJson);

            if (payload.iss !== 'https://appleid.apple.com') {
                socialAuthLogger.warn('Invalid Apple token issuer', { iss: payload.iss });
                return null;
            }

            if (Date.now() >= payload.exp * 1000) {
                socialAuthLogger.warn('Apple token expired');
                return null;
            }

            if (Date.now() < payload.iat * 1000) {
                socialAuthLogger.warn('Apple token issued in future');
                return null;
            }

            return payload;
        } catch (error) {
            socialAuthLogger.error('Failed to verify Apple token', error);
            return null;
        }
    }

    /**
     * Generate a random password for social login users
     */
    private generateRandomPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 32; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
}

export default SocialAuthService;
