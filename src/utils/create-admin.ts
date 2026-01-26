/**
 * Create Admin User Script
 * 
 * This function creates or updates an admin user.
 * Can be called from app.ts on startup.
 */

import { User } from '@domain/models/user.model';
import { UserRole, UserStatus, SocialLoginProvider } from '@domain/enums/user-status.enum';

export async function createAdminUser() {
  console.log('🔧 Creating Admin User...');

  // Admin user details
  const adminEmail = 'admin@yopmail.com';
  const adminPassword = 'admin@mentorai';
  const adminFirstName = 'Admin';
  const adminLastName = 'User';
  const shouldResetPassword = process.env.NODE_ENV !== 'production';

  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      existingAdmin.role = UserRole.ADMIN;
      existingAdmin.status = UserStatus.ACTIVE;
      existingAdmin.emailVerifiedAt = new Date();
      existingAdmin.socialLoginProvider = SocialLoginProvider.EMAIL;
      if (shouldResetPassword) {
        existingAdmin.password = adminPassword;
      }
      await existingAdmin.save();
      console.log(`✅ Admin user ${adminEmail} updated`);
    } else {
      // Create new admin user (password will be hashed by pre-save hook)
      const adminUser = new User({
        email: adminEmail,
        password: adminPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        socialLoginProvider: SocialLoginProvider.EMAIL,
      });

      await adminUser.save();
      console.log(`✅ Admin user created: ${adminEmail}`);
    }

    console.log('================================');
    console.log('🛡️  ADMIN CREDENTIALS');
    console.log(`📧 Email:    ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log('================================');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}
