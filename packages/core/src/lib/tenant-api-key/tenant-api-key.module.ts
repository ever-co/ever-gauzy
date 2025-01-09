import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EncryptionService } from '../common/encryption/encryption.service';
import { TenantApiKeyController } from './tenant-api-key.controller';
import { TenantApiKey } from './tenant-api-key.entity';
import { TenantApiKeyService } from './tenant-api-key.service';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from '../user/user.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([TenantApiKey]),
		MikroOrmModule.forFeature([TenantApiKey]),
		RolePermissionModule,
		UserModule
	],
	controllers: [
		TenantApiKeyController
	],
	providers: [
		TenantApiKeyService,
		EncryptionService,
		TypeOrmTenantApiKeyRepository
	]
})
export class TenantApiKeyModule {}
