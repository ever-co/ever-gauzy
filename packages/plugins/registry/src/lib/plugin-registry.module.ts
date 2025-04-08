import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { handlers } from './application/handlers';
import { entities } from './domain/entities';
import { repositories } from './domain/repositories';
import { services } from './domain/services';
import { controllers } from './infrastructure/controllers';
import { subscribers } from './infrastructure/subscribers';
import { RolePermissionModule } from '@gauzy/core';

@Module({
	imports: [
		TypeOrmModule.forFeature([...entities]),
		MikroOrmModule.forFeature([...entities]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [...services, ...handlers, ...repositories, ...subscribers],
	controllers
})
export class PluginRegistryModule {}
