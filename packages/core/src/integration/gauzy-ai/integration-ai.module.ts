import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { IntegrationAIController } from './integration-ai.controller';
import { IntegrationAIService } from './integration-ai.service';
import { IntegrationModule } from './../integration.module';
import { IntegrationTenantModule } from './../../integration-tenant/integration-tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integrations/gauzy-ai', module: IntegrationAIModule }
		]),
		TenantModule,
		UserModule,
		IntegrationModule,
		IntegrationTenantModule,
		CqrsModule
	],
	controllers: [IntegrationAIController],
	providers: [
		IntegrationAIService
	]
})
export class IntegrationAIModule { }
