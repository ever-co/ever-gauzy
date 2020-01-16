import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { AuthService } from '../auth';
import { UserService, User } from '../user';
import { EmailModule } from '../email-templates/email.module';
import { EmailService } from '../email-templates/email.service';
import { EmailTemplate } from '../email-templates';

@Module({
	imports: [
		TypeOrmModule.forFeature([Organization]),
		TypeOrmModule.forFeature([User]),
		TypeOrmModule.forFeature([EmailTemplate]),
		EmailModule
	],
	controllers: [OrganizationController],
	providers: [OrganizationService, AuthService, UserService, EmailService],
	exports: [OrganizationService]
})
export class OrganizationModule {}
