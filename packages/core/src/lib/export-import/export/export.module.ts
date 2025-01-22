import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([...coreEntities, ...getEntitiesFromPlugins(getConfig().plugins)]),
		MikroOrmModule.forFeature([...coreEntities, ...getEntitiesFromPlugins(getConfig().plugins)]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ExportController],
	providers: [ExportService]
})
export class ExportModule {}
