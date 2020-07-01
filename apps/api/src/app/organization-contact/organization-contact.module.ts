import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactController } from './organization-contact.controller';
import { OrganizationContactService } from './organization-contact.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EmailService, Email } from '../email';
import { EmailTemplate } from '../email-template';
import { OrganizationService } from '../organization/organization.service';
import { Organization } from '../organization/organization.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			OrganizationContact,
			Organization,
			User,
			Email,
			EmailTemplate
		]),
		CqrsModule
	],
	controllers: [OrganizationContactController],
	providers: [
		OrganizationContactService,
		UserService,
		EmailService,
		OrganizationService,
		...CommandHandlers
	],
	exports: [OrganizationContactService]
})
export class OrganizationContactModule {}
