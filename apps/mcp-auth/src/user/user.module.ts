import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginAttemptModule, User, Employee, UserTwoFactor } from '@gauzy/core';
import { OAuthUserService } from './oauth-user.service';

/**
 * Lightweight User Module for OAuth Server
 *
 * This is a minimal UserModule that only includes what's needed for OAuth authentication
 */
@Module({
	imports: [
		// Register the User entity, the Employee entity whose status also gates sign-in, and the two-factor record that
		// refuses a password-only sign-in (this form cannot ask for the code), with TypeORM only
		TypeOrmModule.forFeature([User, Employee, UserTwoFactor]),
		// The per-account login failure counter the Gauzy API's login uses
		LoginAttemptModule
	],
	providers: [OAuthUserService],
	exports: [OAuthUserService]
})
export class UserModule {}
