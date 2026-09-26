import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TagType } from './tag-type.entity';
import { TagTypeResolver } from './tag-type.resolver';
import { TagTypeService } from './tag-type.service';
import { TagTypeController } from './tag-type.controller';
import { TypeOrmTagTypeRepository } from './repository/type-orm-tag-type.repository';
import { MikroOrmTagTypeRepository } from './repository/mikro-orm-tag-type.repository';

/**
 * The tag type domain.
 *
 * The resolver is declared beside the service it calls — a resolver can only inject services its own
 * module can reach — and the service is exported for it as well, because the module that hosts the
 * resolver is the module the Apollo configuration names rather than this one. Everything the resolver
 * injects is therefore reachable from here: the service below, and the two guards, which are providers
 * of the permission module this module imports (and which the resolver module imports in its turn).
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([TagType]),
		MikroOrmModule.forFeature([TagType]),
		RolePermissionModule
	],
	controllers: [TagTypeController],
	providers: [TagTypeService, TagTypeResolver, TypeOrmTagTypeRepository, MikroOrmTagTypeRepository],
	exports: [TagTypeService]
})
export class TagTypeModule {}