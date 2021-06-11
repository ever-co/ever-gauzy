import { HttpModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { GauzyCloudController } from './gauzy-cloud.controller';
import { GauzyCloudService } from './gauzy-cloud.service';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../tenant';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/cloud', module: GauzyCloudModule }
		]),
		HttpModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				baseURL: configService.get('gauzyCloudEndpoint') as string,
				timeout: 5000,
				maxRedirects: 5
			}),
			inject: [ConfigService],
		}),
		CqrsModule,
		TenantModule
	],
	controllers: [GauzyCloudController],
	providers: [GauzyCloudService],
	exports: []
})
export class GauzyCloudModule {}