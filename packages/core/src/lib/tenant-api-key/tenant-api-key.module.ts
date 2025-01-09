import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantApiKey } from './tenant-api-key.entity';
import { TenantApiKeyService } from './tenant-api-key.service';
import { TypeOrmTenantApiKeyRepository } from './repository/type-orm-tenant-api-key.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TenantApiKey]),
		MikroOrmModule.forFeature([TenantApiKey])
	],
	providers: [
		TenantApiKeyService,
		TypeOrmTenantApiKeyRepository
	]
})
export class TenantApiKeyModule {}
