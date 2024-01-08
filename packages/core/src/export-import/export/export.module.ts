import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
// import { getEntitiesFromPlugins } from '@gauzy/plugin';
// import { getConfig } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { TenantModule } from '../../tenant/tenant.module';
import { UserModule } from '../../user/user.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/export', module: ExportModule }
		]),
		TypeOrmModule.forFeature([
			...coreEntities,
			// ToDo: We need to load plugins entities here dynamically
			// ...getEntitiesFromPlugins(getConfig().plugins)
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [ExportController],
	providers: [ExportService],
	exports: []
})
export class ExportModule { }
