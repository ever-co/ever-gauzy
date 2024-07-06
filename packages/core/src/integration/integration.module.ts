import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { CommandHandlers } from './commands/handlers';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { GithubModule } from './github/github.module';
import { IntegrationAIModule } from './gauzy-ai/integration-ai.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/integration',
				module: IntegrationModule,
				children: [
					{ path: '/github', module: GithubModule },
					{ path: '/gauzy-ai', module: IntegrationAIModule },
					{ path: '/', module: IntegrationModule }
				]
			}
		]),
		TypeOrmModule.forFeature([Integration, IntegrationType]),
		MikroOrmModule.forFeature([Integration, IntegrationType]),
		IntegrationTenantModule,
		RolePermissionModule,
		forwardRef(() => GithubModule),
		forwardRef(() => IntegrationAIModule),
		CqrsModule
	],
	controllers: [IntegrationController],
	providers: [IntegrationService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, IntegrationService]
})
export class IntegrationModule {}
