import { HttpModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { GauzyCloudController } from './gauzy-cloud.controller';
import { GauzyCloudService } from './gauzy-cloud.service';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../tenant';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/cloud', module: GauzyCloudModule }
		]),
		HttpModule.registerAsync({
			imports: [ConfigModule],
			useFactory: async (configService: ConfigService) => ({
				baseURL: configService.get('gauzyCloudEndpoint') as string,
				timeout: 60 * 1000,
				maxRedirects: 5,
				headers: {
                    'Content-Type': 'application/json',
                }
			}),
			inject: [ConfigService],
		}),
		CqrsModule,
		TenantModule
	],
	controllers: [GauzyCloudController],
	providers: [
		GauzyCloudService, 
		...CommandHandlers
	],
	exports: []
})
export class GauzyCloudModule {}