import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { IntegrationMapController } from './integration-map.controller';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integration-map', module: IntegrationMapModule}
		]),
		TypeOrmModule.forFeature([IntegrationMap]),
		TenantModule,
		CqrsModule
	],
	controllers: [IntegrationMapController],
	providers: [
		IntegrationMapService,
		...CommandHandlers
	],
	exports: [IntegrationMapService]
})
export class IntegrationMapModule {}
