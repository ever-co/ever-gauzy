import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';
import { corentities } from '../../core/entities';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/export', module: ExportModule }
		]),
		TypeOrmModule.forFeature([
			...corentities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		MikroOrmModule.forFeature([
			...corentities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ExportController],
	providers: [ExportService],
	exports: []
})
export class ExportModule { }
