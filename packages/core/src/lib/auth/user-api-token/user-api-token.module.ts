import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { AuthModule } from '../auth.module';
import { MikroOrmUserApiTokenRepository } from './repository/mikro-orm-user-api-token.repository';
import { TypeOrmUserApiTokenRepository } from './repository/type-orm-user-api-token.repository';
import { UserApiTokenController, UserApiTokenExchangeController } from './user-api-token.controller';
import { UserApiToken } from './user-api-token.entity';
import { UserApiTokenService } from './user-api-token.service';
import { UserApiTokensEnabledGuard } from './user-api-tokens-enabled.guard';

/**
 * Personal API tokens. It depends on `AuthModule` for the mint, and nothing depends on it: `AuthModule` knows only the
 * claim such a session carries (`user-api-token-session.ts`), which is what keeps this feature out of the sign-in path.
 *
 * `RolePermissionModule` is imported because `TenantPermissionGuard` on the controller depends on its service.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([UserApiToken]),
		MikroOrmModule.forFeature([UserApiToken]),
		RolePermissionModule,
		AuthModule
	],
	controllers: [UserApiTokenController, UserApiTokenExchangeController],
	providers: [
		UserApiTokenService,
		UserApiTokensEnabledGuard,
		TypeOrmUserApiTokenRepository,
		MikroOrmUserApiTokenRepository
	],
	exports: [UserApiTokenService]
})
export class UserApiTokenModule {}
