import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { RouterModule } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { RoleModule } from './../role/role.module';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { GauzyCloudController } from './gauzy-cloud.controller';
import { GauzyCloudService } from './gauzy-cloud.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/cloud/migrate', module: GauzyCloudModule }]),
		HttpModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				baseURL: configService.get('gauzyCloudEndpoint') as string,
				timeout: 60 * 5 * 1000,
				maxRedirects: 5,
				headers: {
					'Content-Type': 'application/json'
				}
			}),
			inject: [ConfigService]
		}),
		CqrsModule,
		RoleModule,
		RolePermissionModule
	],
	controllers: [GauzyCloudController],
	providers: [GauzyCloudService, ...CommandHandlers]
})
export class GauzyCloudModule {}
