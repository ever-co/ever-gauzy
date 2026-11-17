import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Employee, User } from '../core/entities/internal';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AuthModule } from '../auth/auth.module';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { EmbedCredential } from './embed-credential.entity';
import { EmbedCredentialService } from './embed-credential.service';
import { EmbedCredentialController, EmbedTokenController } from './embed.controller';
import { EmbedEnabledGuard, EmbedSessionGuard } from './embed.guards';
import { MikroOrmEmbedCredentialRepository } from './repository/mikro-orm-embed-credential.repository';
import { TypeOrmEmbedCredentialRepository } from './repository/type-orm-embed-credential.repository';

/**
 * Embedding the timer in other products: credentials a host's backend exchanges for a timer-only token, and the
 * global guard that holds such tokens to the timer. Off by default (`GAUZY_EMBED_TOKENS_ENABLED`). `AuthModule` mints
 * the token; nothing in the sign-in path depends on this module.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmbedCredential, Employee, User]),
		MikroOrmModule.forFeature([EmbedCredential, Employee, User]),
		RolePermissionModule,
		AuthModule
	],
	controllers: [EmbedCredentialController, EmbedTokenController],
	providers: [
		EmbedCredentialService,
		EmbedEnabledGuard,
		TypeOrmEmbedCredentialRepository,
		MikroOrmEmbedCredentialRepository,
		TypeOrmEmployeeRepository,
		MikroOrmEmployeeRepository,
		TypeOrmUserRepository,
		MikroOrmUserRepository,
		{ provide: APP_GUARD, useClass: EmbedSessionGuard }
	],
	exports: [EmbedCredentialService]
})
export class EmbedModule {}
