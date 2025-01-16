import { Module } from '@nestjs/common';
import { TenantApiKeyModule } from '../tenant-api-key/tenant-api-key.module';
import { UserModule } from '../user/user.module';
import { EmailCheckController } from './email-check.controller';
import { EmailCheckService } from './email-check.service';

@Module({
	imports: [UserModule, TenantApiKeyModule],
	controllers: [EmailCheckController],
	providers: [EmailCheckService]
})
export class EmailCheckModule {}
