import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { ResourceLink } from './resource-link.entity';
import { ResourceLinkService } from './resource-link.service';
import { ResourceLinkController } from './resource-link.controller';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/resource-link', module: ResourceLinkModule }]),
		TypeOrmModule.forFeature([ResourceLink]),
		MikroOrmModule.forFeature([ResourceLink]),
		RolePermissionModule,
		UserModule,
		CqrsModule
	],
	controllers: [ResourceLinkController],
	providers: [ResourceLinkService, TypeOrmResourceLinkRepository, ...CommandHandlers],
	exports: [ResourceLinkService, TypeOrmResourceLinkRepository]
})
export class ResourceLinkModule {}
