import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { TenantModule } from '../../tenant/tenant.module';
import { UserModule } from '../../user/user.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/export', module: ExportModule }]),
		TypeOrmModule.forFeature([...coreEntities, ...getEntitiesFromPlugins(getConfig().plugins)]),
		MikroOrmModule.forFeature([...coreEntities, ...getEntitiesFromPlugins(getConfig().plugins)]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [ExportController],
	providers: [ExportService],
	exports: []
})
export class ExportModule { }
