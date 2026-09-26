import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from '../user/user.module';
import { FeatureModule } from '../feature/feature.module';
import { TenantApiKeyController } from './tenant-api-key.controller';
import { TenantApiKeyResolver } from './tenant-api-key.resolver';
import { TenantApiKey } from './tenant-api-key.entity';
import { TenantApiKeyService } from './tenant-api-key.service';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';

/**
 * The tenant API key: the pair a machine caller authenticates with.
 *
 * `FeatureModule` is imported for the guard rather than for a resolver: the GraphQL surface is gated
 * by `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it
 * protects — so this module is what has to reach the feature service the guard resolves through.
 * Without it the API boot fails on an unresolved dependency, which no static check sees.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TenantApiKey]),
		MikroOrmModule.forFeature([TenantApiKey]),
		RolePermissionModule,
		UserModule,
		FeatureModule
	],
	controllers: [TenantApiKeyController],
	providers: [
		TenantApiKeyService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TenantApiKeyResolver,
		TypeOrmTenantApiKeyRepository,
		MikroOrmTenantApiKeyRepository
	],
	exports: [TenantApiKeyService, TypeOrmTenantApiKeyRepository, MikroOrmTenantApiKeyRepository]
})
export class TenantApiKeyModule {}