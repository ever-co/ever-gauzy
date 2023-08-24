import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EmailTemplateModule } from './../email-template/email-template.module';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { OrganizationModule } from './../organization/organization.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CustomSmtpModule } from './../custom-smtp/custom-smtp.module';
import { EmailSendModule } from './../email-send/email-send.module';
import { EmailHistoryService } from './email-history.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/email', module: EmailModule }
		]),
		TypeOrmModule.forFeature([
			Email
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => EmailTemplateModule),
		forwardRef(() => CustomSmtpModule),
		EmailSendModule
	],
	controllers: [EmailController],
	providers: [
		EmailService,
		EmailHistoryService
	],
	exports: [
		TypeOrmModule,
		EmailService
	]
})
export class EmailModule { }
