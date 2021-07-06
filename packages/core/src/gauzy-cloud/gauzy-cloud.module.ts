import { forwardRef, HttpModule, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { GauzyCloudController } from './gauzy-cloud.controller';
import { GauzyCloudService } from './gauzy-cloud.service';
import { TenantModule } from './../tenant';
import { CommandHandlers } from './commands/handlers';
import { RoleModule } from './../role/role.module';
import { UserModule } from './../user';
@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/cloud/migrate', module: GauzyCloudModule }
		]),
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
			inject: [ConfigService],
		}),
		CqrsModule,
		forwardRef(() => UserModule),
		TenantModule,
		RoleModule,
	],
	controllers: [GauzyCloudController],
	providers: [
		GauzyCloudService, 
		...CommandHandlers
	],
	exports: []
})
export class GauzyCloudModule {}