import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactController } from './organization-contact.controller';
import { OrganizationContactResolver } from './organization-contact.resolver';
import { OrganizationContactService } from './organization-contact.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationModule } from './../organization/organization.module';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { ContactModule } from '../contact/contact.module';
import { TypeOrmOrganizationContactRepository } from './repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationContactRepository } from './repository/mikro-orm-organization-contact.repository';

/**
 * The party row: the customer, the client, the lead and the seller contact of the CRM.
 *
 * **The resolver is declared here, beside the service and the command bus it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The REST controller beside the resolver
 * resolves the command bus from this module's own imports, so the service was the only export that
 * was needed until the GraphQL view of the same resource existed. The resolver is a provider of
 * whichever module the Apollo configuration names — the resolver graph imports this module and hosts
 * the resolver itself — and a module's imports are not inherited by the module that imports it, so
 * the command bus the two write fields dispatch through has to be handed on.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationContact]),
		MikroOrmModule.forFeature([OrganizationContact]),
		RolePermissionModule,
		OrganizationModule,
		OrganizationProjectModule,
		ContactModule,
		CqrsModule
	],
	controllers: [OrganizationContactController],
	providers: [
		OrganizationContactService,
		// The GraphQL view of the same resource.
		OrganizationContactResolver,
		TypeOrmOrganizationContactRepository,
		MikroOrmOrganizationContactRepository,
		...CommandHandlers
	],
	exports: [
		OrganizationContactService,
		TypeOrmOrganizationContactRepository,
		MikroOrmOrganizationContactRepository,
		CqrsModule
	]
})
export class OrganizationContactModule {}
