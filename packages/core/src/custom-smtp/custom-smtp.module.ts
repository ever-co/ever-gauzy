import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpService } from './custom-smtp.service';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands';
import { CqrsModule } from '@nestjs/cqrs';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/smtp', module: CustomSmtpModule }]),
		TypeOrmModule.forFeature([CustomSmtp]),
		AuthModule,
		TenantModule,
		CqrsModule,
		EmailModule
	],
	controllers: [CustomSmtpController],
	providers: [CustomSmtpService, EmailService, ...CommandHandlers]
})
export class CustomSmtpModule {}
