import { RolePermissionModule, TagModule } from '@gauzy/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { handlers } from './application/handlers';
import { entities } from './domain/entities';
import { eventHandlers } from './domain/events/handlers';
import { factories } from './domain/factories';
import { repositories } from './domain/repositories';
import { services } from './domain/services';
import { controllers } from './infrastructure/controllers';
import { subscribers } from './infrastructure/subscribers';
@Module({
	imports: [
		TypeOrmModule.forFeature([...entities]),
		MikroOrmModule.forFeature([...entities]),
		RolePermissionModule,
		TagModule,
		CqrsModule
	],
	providers: [...services, ...handlers, ...repositories, ...subscribers, ...eventHandlers, ...factories],
	controllers
})
export class PluginRegistryModule {}
