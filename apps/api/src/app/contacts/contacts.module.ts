import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contacts } from './contacts.entity';
// import { OrganizationClientsController } from './organization-clients.controller';
// import { OrganizationClientsService } from './organization-clients.service';
import { CqrsModule } from '@nestjs/cqrs';
// import { CommandHandlers } from './commands/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EmailService, Email } from '../email';
import { EmailTemplate } from '../email-template';
import { OrganizationService } from '../organization/organization.service';
import { Organization } from '../organization/organization.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Contacts,
			Organization,
			User,
			Email,
			EmailTemplate
		]),
		CqrsModule
	],
	// controllers: [OrganizationClientsController],
	providers: [
		// OrganizationClientsService,
		UserService,
		EmailService,
		OrganizationService
		// ...CommandHandlers
	]
	// exports: [OrganizationClientsService]
})
export class OrganizationContactModule {}
