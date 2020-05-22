import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationContacts } from './organization-contacts.entity';
import { OrganizationContactsController } from './organization-contacts.controller';
import { OrganizationContactsService } from './organization-contacts.service';
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
			OrganizationContacts,
			Organization,
			User,
			Email,
			EmailTemplate
		]),
		CqrsModule
	],
	controllers: [OrganizationContactsController],
	providers: [
		OrganizationContactsService,
		UserService,
		EmailService,
		OrganizationService,
		...CommandHandlers
	],
	exports: [OrganizationContactsService]
})
export class OrganizationContactsModule {}
