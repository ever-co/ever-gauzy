import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationClients } from './organization-clients.entity';
import { OrganizationClientsController } from './organization-clients.controller';
import { OrganizationClientsService } from './organization-clients.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EmailService, Email } from '../email';
import { EmailTemplate } from '../email-template';
import { OrganizationService } from '../organization/organization.service';
import { Organization } from '../organization/organization.entity';
// import { ContactsService } from '../contacts/contacts.service';
// import { ContactModule } from '../contacts/contacts.module';
// import { Contacts } from '../contacts/contacts.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			OrganizationClients,
			Organization,
			// Contacts,
			User,
			Email,
			EmailTemplate
		]),
		CqrsModule
		// ContactModule,
	],
	controllers: [OrganizationClientsController],
	providers: [
		OrganizationClientsService,
		UserService,
		EmailService,
		OrganizationService,
		// ContactsService,
		...CommandHandlers
	],
	exports: [OrganizationClientsService]
})
export class OrganizationClientsModule {}
