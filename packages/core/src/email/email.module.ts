import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailTemplateModule } from './../email-template/email-template.module';
import { OrganizationModule } from './../organization/organization.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CustomSmtpModule } from './../custom-smtp/custom-smtp.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/email', module: EmailModule }
		]),
		TypeOrmModule.forFeature([Email]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => EmailTemplateModule),
		forwardRef(() => OrganizationModule),
		forwardRef(() => CustomSmtpModule)
	],
	controllers: [EmailController],
	providers: [EmailService],
	exports: [
		TypeOrmModule,
		EmailService
	]
})
export class EmailModule {}
