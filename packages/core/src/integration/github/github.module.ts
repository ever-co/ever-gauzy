import { MiddlewareConsumer, Module, NestModule, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from 'tenant/tenant.module';
import { UserModule } from 'user/user.module';
import { IntegrationModule } from 'integration/integration.module';
import { IntegrationTenantModule } from 'integration-tenant/integration-tenant.module';
import { GitHubAuthorizationController } from './github-authorization.controller';
import { GitHubController } from './github.controller';
import { GitHubIntegrationController } from './github-integration.controller';
import { GitHubHooksController } from './github.events.controller';
import { GithubService } from './github.service';
import { GithubHooksService } from './github.events.service';
import { GithubMiddleware } from './github.middleware';

@Module({
	imports: [
		HttpModule,
		TenantModule,
		UserModule,
		CqrsModule,
		forwardRef(() => IntegrationModule),
		forwardRef(() => IntegrationTenantModule)
	],
	controllers: [
		GitHubAuthorizationController,
		GitHubController,
		GitHubIntegrationController,
		GitHubHooksController
	],
	providers: [
		GithubService,
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
		consumer.apply(GithubMiddleware).forRoutes(
			RouterModule.resolvePath(GitHubIntegrationController) // Apply to GitHubIntegrationController
		)
	}
}
