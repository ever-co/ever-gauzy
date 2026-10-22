import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginAttemptModule, User } from '@gauzy/core';
import { OAuthUserService } from './oauth-user.service';

/**
 * Lightweight User Module for OAuth Server
 *
 * This is a minimal UserModule that only includes what's needed for OAuth authentication
 */
@Module({
	imports: [
		// Register User entity with TypeORM only
		TypeOrmModule.forFeature([User]),
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
