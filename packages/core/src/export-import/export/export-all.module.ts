import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RouterModule } from 'nest-router';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';
import { TenantModule } from './../../tenant/tenant.module';
import { coreEntities } from './../../core/entities';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { ImportRecordModule } from './../../export-import/import-record';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/download', module: ExportAllModule }
		]),
		CqrsModule,
		TypeOrmModule.forFeature([
			...coreEntities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		ImportRecordModule,
		TenantModule
	],
	controllers: [ExportAllController],
	providers: [
		ExportAllService
	],
	exports: [DataSource]
})
export class ExportAllModule {}