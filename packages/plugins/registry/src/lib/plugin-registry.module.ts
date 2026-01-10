import { RoleModule, RolePermissionModule, TagModule, UserModule } from '@gauzy/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { handlers } from './application';
import { entities, factories, repositories, services } from './domain';
import { eventHandlers } from './domain/events/handlers';
import { controllers, subscribers } from './infrastructure';
@Module({
	imports: [
		TypeOrmModule.forFeature([...entities]),
		MikroOrmModule.forFeature([...entities]),
		UserModule,
		RolePermissionModule,
		RoleModule,
		TagModule,
		CqrsModule
	],
	providers: [...services, ...handlers, ...repositories, ...subscribers, ...eventHandlers, ...factories],
	controllers
})
export class PluginRegistryModule {}
