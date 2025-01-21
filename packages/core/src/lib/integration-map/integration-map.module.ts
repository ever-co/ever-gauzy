import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { TagModule } from '../tags/tag.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationMapController } from './integration-map.controller';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';
import { TypeOrmIntegrationMapRepository } from './repository/type-orm-integration-map.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationMap]),
		MikroOrmModule.forFeature([IntegrationMap]),
		RolePermissionModule,
		TaskModule,
		TagModule,
		CqrsModule
	],
	controllers: [IntegrationMapController],
	providers: [IntegrationMapService, TypeOrmIntegrationMapRepository, ...CommandHandlers],
	exports: [IntegrationMapService]
})
export class IntegrationMapModule {}
