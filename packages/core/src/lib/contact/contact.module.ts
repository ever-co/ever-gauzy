import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Contact } from './contact.entity';
import { ContactController } from './contact.controller';
import { ContactResolver } from './contact.resolver';
import { ContactService } from './contact.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmContactRepository } from './repository/type-orm-contact.repository';
import { MikroOrmContactRepository } from './repository/mikro-orm-contact.repository';

/**
 * The customer record: the person-or-place detail row behind a party.
 *
 * **The resolver is declared here, beside the service it calls**, because a resolver is an ordinary
 * Nest provider and can only inject what the module hosting it can reach. `ContactService` is
 * already exported — the module that hosts the GraphQL resolver graph imports this one and receives
 * the service through that export — so the GraphQL view of the same resource adds a provider and no
 * second dependency: this resolver injects the service and nothing else.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Contact]),
		MikroOrmModule.forFeature([Contact]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ContactController],
	providers: [
		ContactService,
		// The GraphQL view of the same resource.
		ContactResolver,
		TypeOrmContactRepository,
		MikroOrmContactRepository,
		...CommandHandlers
	],
	exports: [ContactService]
})
export class ContactModule {}
