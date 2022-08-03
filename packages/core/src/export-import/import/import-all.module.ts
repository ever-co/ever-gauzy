import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService, getConfig } from '@gauzy/config';
import { API_DB_CONNECTION } from '@gauzy/common';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { ImportAllController } from './import-all.controller';
import { ImportAllService } from './import-all.service';
import { coreEntities } from './../../core/entities';
import { CommandHandlers } from './commands/handlers';
import { ImportRecordModule } from './../import-record';
import { ImportHistoryModule } from './../import-history';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { initializedDataSource } from './../../database/database-helper';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/import',
				module: ImportAllModule
			}
		]),
		CqrsModule,
		MulterModule.register({
			dest: './import'
		}),
		TypeOrmModule.forFeature([
			...coreEntities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		TenantModule,
		UserModule,
		ImportRecordModule,
		ImportHistoryModule
	],
	controllers: [ImportAllController],
	providers: [
		ImportAllService,
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
		...CommandHandlers
	],
	exports: []
})
export class ImportAllModule {}
