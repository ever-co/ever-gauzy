/**
 * `OAuthClientModule` — registers the multi-app OAuth client registry
 * (entity, dual-ORM repositories, service, admin controller).
 *
 * What changed from the single-app version:
 * Previously there was no module — the one OAuth client was an env var
 * read by `SocialAuthService.getOAuthAppConfig()`. This module exposes
 * the registry so the auth pipeline (Section 3) can inject
 * `OAuthClientService` to resolve clients per-request, and so the admin
 * UI can register Activepieces / n8n / etc. via `/oauth/clients`.
 *
 * `RolePermissionModule` is imported because the controller is guarded
 * with `TenantPermissionGuard` + `PermissionGuard`, both of which depend
 * on the role-permission service.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { OAuthClient } from './oauth-client.entity';
import { OAuthClientService } from './oauth-client.service';
import { OAuthClientController } from './oauth-client.controller';
import { TypeOrmOAuthClientRepository } from './repository/type-orm-oauth-client.repository';
import { MikroOrmOAuthClientRepository } from './repository/mikro-orm-oauth-client.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OAuthClient]),
		MikroOrmModule.forFeature([OAuthClient]),
		RolePermissionModule
	],
	controllers: [OAuthClientController],
	providers: [OAuthClientService, TypeOrmOAuthClientRepository, MikroOrmOAuthClientRepository],
	exports: [OAuthClientService, TypeOrmOAuthClientRepository, MikroOrmOAuthClientRepository]
})
export class OAuthClientModule {}
