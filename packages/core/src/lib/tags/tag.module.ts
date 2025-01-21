import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IntegrationMap } from '../core/entities/internal';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { Tag } from './tag.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTagRepository } from './repository/type-orm-tag.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Tag, IntegrationMap]),
		MikroOrmModule.forFeature([Tag, IntegrationMap]),
		RolePermissionModule
	],
	controllers: [TagController],
	providers: [TagService, TypeOrmTagRepository, ...CommandHandlers],
	exports: [TagService, TypeOrmTagRepository]
})
export class TagModule {}
