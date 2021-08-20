import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { CommandHandlers } from './commands/handlers';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { TenantModule } from './../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integration', module: IntegrationModule }
		]),
		TypeOrmModule.forFeature([
			Integration,
			IntegrationType
		]),
		TenantModule,
		IntegrationTenantModule,
		CqrsModule
	],
	controllers: [IntegrationController],
	providers: [IntegrationService, ...CommandHandlers],
	exports: [IntegrationService]
})
export class IntegrationModule {}