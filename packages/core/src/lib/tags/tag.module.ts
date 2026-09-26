import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IntegrationMap } from '../core/entities/internal';
import { TagController } from './tag.controller';
import { TagResolver } from './tag.resolver';
import { TagService } from './tag.service';
import { Tag } from './tag.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';

/**
 * The tag domain.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: the list root field dispatches the same `TagListCommand` the REST list route
 * dispatches, and a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names — so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Tag, IntegrationMap]),
		MikroOrmModule.forFeature([Tag, IntegrationMap]),
		RolePermissionModule
	],
	controllers: [TagController],
	providers: [
		TagService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		TagResolver,
		TypeOrmTagRepository,
		MikroOrmTagRepository,
		...CommandHandlers
	],
	exports: [TagService, CqrsModule, TypeOrmTagRepository, MikroOrmTagRepository]
})
export class TagModule {}