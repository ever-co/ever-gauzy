import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from 'tenant/tenant.module';
import { UserModule } from 'user/user.module';
import { HubstaffModule } from './hubstaff/hubstaff.module';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { CommandHandlers } from './commands/handlers';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { IntegrationAIModule } from './gauzy-ai/integration-ai.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/integration', module: IntegrationModule,
				children: [
					{ path: '/hubstaff', module: HubstaffModule },
					{ path: '/gauzy-ai', module: IntegrationAIModule },
					{ path: '/', module: IntegrationModule }
				]
			},
		]),
		TypeOrmModule.forFeature([
			Integration,
			IntegrationType
		]),
		TenantModule,
		IntegrationTenantModule,
		TenantModule,
		UserModule,
		forwardRef(() => HubstaffModule),
		forwardRef(() => IntegrationAIModule),
		CqrsModule
	],
	controllers: [
		IntegrationController
	],
	providers: [
		IntegrationService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		IntegrationService
	]
})
export class IntegrationModule { }
