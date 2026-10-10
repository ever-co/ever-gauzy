import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { CommandHandlers } from './commands/handlers';
import { ResourceLink } from './resource-link.entity';
import { ResourceLinkService } from './resource-link.service';
import { ResourceLinkController } from './resource-link.controller';
import { ResourceLinkResolver } from './resource-link.resolver';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';
import { MikroOrmResourceLinkRepository } from './repository/mikro-orm-resource-link.repository';

/**
 * The reading list a record carries beside it.
 *
 * `CqrsModule` is re-exported, not merely imported, because the resolver dispatches the same two
 * commands the REST controller dispatches: a resolver is a provider of whichever module hosts the
 * handler the Apollo configuration names, so a module that imports this one receives the command bus
 * only if this module hands it on.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ResourceLink]),
		MikroOrmModule.forFeature([ResourceLink]),
		RolePermissionModule,
		EmployeeModule,
		CqrsModule
	],
	controllers: [ResourceLinkController],
	providers: [
		ResourceLinkService,
		// The GraphQL view of the same resource.
		ResourceLinkResolver,
		TypeOrmResourceLinkRepository,
		MikroOrmResourceLinkRepository,
		...CommandHandlers
	],
	exports: [ResourceLinkService, CqrsModule]
})
export class ResourceLinkModule {}