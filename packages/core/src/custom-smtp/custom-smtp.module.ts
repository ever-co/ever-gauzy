import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands';
import { EmailModule } from '../email/email.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/smtp', module: CustomSmtpModule }
		]),
		TypeOrmModule.forFeature([CustomSmtp]),
		TenantModule,
		EmailModule,
		CqrsModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, ...CommandHandlers],
	exports: [CustomSmtpService]
})
export class CustomSmtpModule {}
