import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { RouterModule } from 'nest-router';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { ConfigModule, ConfigService, getConfig } from '@gauzy/config';
import { API_DB_CONNECTION } from '@gauzy/common';
import { TenantModule } from './../../tenant/tenant.module';
import { coreEntities } from './../../core/entities';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { ImportRecordModule } from './../../export-import/import-record';
import { initializedDataSource } from './../../database/database-helper';

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
		TenantModule,
		ConfigModule
	],
	controllers: [ExportAllController],
	providers: [
		ExportAllService,
		{
			provide: DataSource,
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => {
				const { dbConnectionOptions } = configService.config;
				return initializedDataSource({
					name: API_DB_CONNECTION,
					...dbConnectionOptions
				} as DataSourceOptions);
			},
		},
	],
	exports: [DataSource]
})
export class ExportAllModule {}