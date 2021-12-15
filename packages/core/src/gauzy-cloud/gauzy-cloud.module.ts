import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { RouterModule } from 'nest-router';
import { ConfigModule, ConfigService } from '@gauzy/config';
import { TenantModule } from './../tenant/tenant.module';
import { RoleModule } from './../role/role.module';
import { UserModule } from './../user/user.module';
import { GauzyCloudController } from './gauzy-cloud.controller';
import { GauzyCloudService } from './gauzy-cloud.service';
import { CommandHandlers } from './commands/handlers';

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