import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { LoginAttemptModule } from '../login-attempt.module';
import { MikroOrmUserTwoFactorRepository } from './repository/mikro-orm-user-two-factor.repository';
import { TypeOrmUserTwoFactorRepository } from './repository/type-orm-user-two-factor.repository';
import { UserTwoFactor } from './user-two-factor.entity';
import { UserTwoFactorService } from './user-two-factor.service';

/**
 * The store of two-factor authentication: its table, its checks and its count of wrong codes. It depends on nothing of
 * the sign-in, so `AuthModule` (whose sign-ins ask it whether a user has it on) imports it without a cycle; the routes
 * live in `AuthModule`, which issues the session a code completes.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([UserTwoFactor]),
		MikroOrmModule.forFeature([UserTwoFactor]),
		LoginAttemptModule
	],
	providers: [
		UserTwoFactorService,
		EncryptionService,
		TypeOrmUserTwoFactorRepository,
		MikroOrmUserTwoFactorRepository
	],
	exports: [UserTwoFactorService]
})
export class UserTwoFactorModule {}
