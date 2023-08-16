import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { TenantModule } from '../../tenant/tenant.module';
import { UserModule } from '../../user/user.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/export', module: ExportModule }
		]),
		TypeOrmModule.forFeature([
			...coreEntities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [
		ExportController
	],
	providers: [
		ExportService
	],
	exports: []
})
export class ExportModule { }
