import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [
		TypeOrmModule.forFeature([CustomSmtp]),
		AuthModule,
		TenantModule,
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, ...CommandHandlers]
})
export class CustomSmtpModule {}
