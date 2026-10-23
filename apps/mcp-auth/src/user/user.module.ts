import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginAttemptModule, User, Employee } from '@gauzy/core';
import { OAuthUserService } from './oauth-user.service';

/**
 * Lightweight User Module for OAuth Server
 *
 * This is a minimal UserModule that only includes what's needed for OAuth authentication
 */
@Module({
	imports: [
		// Register the User entity, and the Employee entity whose status also gates sign-in, with TypeORM only
		TypeOrmModule.forFeature([User, Employee]),
		// The per-account login failure counter the Gauzy API's login uses
		LoginAttemptModule
	],
	providers: [
		OAuthUserService
	],
	exports: [
		OAuthUserService
	]
})
export class UserModule {}
