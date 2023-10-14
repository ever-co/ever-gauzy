import { MiddlewareConsumer, Module, NestModule, RequestMethod, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from 'tenant/tenant.module';
import { UserModule } from 'user/user.module';
import { IntegrationModule } from 'integration/integration.module';
import { IntegrationTenantModule } from 'integration-tenant/integration-tenant.module';
import { OrganizationProjectModule } from 'organization-project/organization-project.module';
import { GitHubAuthorizationController } from './github-authorization.controller';
import { GitHubIntegrationController } from './github-integration.controller';
import { GitHubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubMiddleware } from './github.middleware';
import { GitHubHooksController } from './github.hooks.controller';
import { GithubHooksService } from './github.hooks.service';
import { GitHubSyncController } from './github-sync.controller';
import { GithubSyncService } from './github-sync.service';

@Module({
	imports: [
		HttpModule,
		TenantModule,
		UserModule,
		CqrsModule,
		forwardRef(() => OrganizationProjectModule),
		forwardRef(() => IntegrationModule),
		forwardRef(() => IntegrationTenantModule)
	],
	controllers: [
		GitHubAuthorizationController,
		GitHubController,
		GitHubHooksController,
		GitHubIntegrationController,
		GitHubSyncController
	],
	providers: [
		GithubService,
		GithubSyncService,
		GithubHooksService,
		// Define middleware heres
		GithubMiddleware
	],
	exports: [],
})
export class GithubModule implements NestModule {
	/**
	 *
	 * @param consumer
	 */
	configure(consumer: MiddlewareConsumer) {
		// Apply middlewares to specific controllers
		consumer
			.apply(GithubMiddleware)
			.forRoutes(
				{
					path: '/integration/github/:integrationId/metadata',
					method: RequestMethod.GET
				},
				{
					path: '/integration/github/:integrationId/repositories',
					method: RequestMethod.GET
				},
				{
					path: '/integration/github/:integrationId/:owner/:repo/issues',
					method: RequestMethod.GET
				}
			); // Apply to specific routes and methods
	}
}
