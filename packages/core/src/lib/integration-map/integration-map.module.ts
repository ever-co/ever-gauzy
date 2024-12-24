import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { TagModule } from '../tags/tag.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationMapController } from './integration-map.controller';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/integration-map',
				module: IntegrationMapModule
			}
		]),
		TypeOrmModule.forFeature([IntegrationMap]),
		MikroOrmModule.forFeature([IntegrationMap]),
		RolePermissionModule,
		TaskModule,
		TagModule,
		CqrsModule
	],
	controllers: [IntegrationMapController],
	providers: [IntegrationMapService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, IntegrationMapService]
})
export class IntegrationMapModule {}
