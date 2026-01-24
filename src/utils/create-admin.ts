/**
 * Create Admin User Script
 * 
 * This function creates or updates an admin user.
 * Can be called from app.ts on startup.
 */

import { User } from '@domain/models/user.model';
import crypto from 'crypto';

// Hash password function (same as in User model)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function createAdminUser() {
  console.log('🔧 Creating Admin User...');

  // Admin user details
  const adminEmail = 'admin@yopmail.com';
  const adminPassword = 'admin@mentorai';
  const adminFirstName = 'Admin';
  const adminLastName = 'User';

  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      // Update existing user to admin role
      if (existingAdmin.role !== 'admin') {
        await User.updateOne(
          { email: adminEmail },
          { 
            $set: { 
              role: 'admin',
              status: 'active',
              emailVerifiedAt: new Date(),
            } 
          }
        );
        console.log(`✅ User ${adminEmail} updated to admin role`);
      } else {
        console.log(`ℹ️  Admin user ${adminEmail} already exists`);
      }
    } else {
      // Create new admin user
      const hashedPassword = hashPassword(adminPassword);
      
      const adminUser = new User({
        email: adminEmail,
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'admin',
        status: 'active',
        emailVerifiedAt: new Date(),
        socialLoginProvider: 'email',
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
