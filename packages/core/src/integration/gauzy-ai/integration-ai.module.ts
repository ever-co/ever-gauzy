import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { GauzyAIIntegrationController } from './integration-ai.controller';
import { GauzyAIIntegrationService } from './integration-ai.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integrations/gauzy-ai', module: GauzyAIIntegrationModule }
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [GauzyAIIntegrationController],
	providers: [
		GauzyAIIntegrationService
	]
})
export class GauzyAIIntegrationModule { }
