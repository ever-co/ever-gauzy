import { Module } from '@nestjs/common';
import { TenantApiKeyService } from './tenant-api-key.service';

@Module({
	providers: [TenantApiKeyService]
})
export class TenantApiKeyModule {}
