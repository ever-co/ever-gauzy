import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Integration, IntegrationType]),
		CqrsModule,
		IntegrationTenantModule
	],
	controllers: [IntegrationController],
	providers: [IntegrationService, ...CommandHandlers]
})
export class IntegrationModule {}
