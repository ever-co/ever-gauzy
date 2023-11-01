import { MiddlewareConsumer, Module, NestModule, RequestMethod, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from 'tenant/tenant.module';
import { UserModule } from 'user/user.module';
import { IntegrationModule } from 'integration/integration.module';
import { IntegrationTenantModule } from 'integration-tenant/integration-tenant.module';
import { IntegrationSettingModule } from 'integration-setting/integration-setting.module';
import { IntegrationMapModule } from 'integration-map/integration-map.module';
import { OrganizationProjectModule } from 'organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { GitHubAuthorizationController } from './github-authorization.controller';
import { GitHubIntegrationController } from './github-integration.controller';
import { GitHubController } from './github.controller';
import { GithubService } from './github.service';
import { GithubMiddleware } from './github.middleware';
import { GitHubHooksController } from './github.hooks.controller';
import { GithubHooksService } from './github.hooks.service';
import { GitHubSyncController } from './github-sync.controller';
import { GithubSyncService } from './github-sync.service';
import { GitHubRepositoryController } from './repository/github-repository.controller';
import { GithubRepositoryService } from './repository/github-repository.service';
import { OrganizationGithubRepository } from './repository/github-repository.entity';
import { OrganizationGithubRepositoryIssue } from './repository/issue/github-repository-issue.entity';
import { GithubRepositoryIssueService } from './repository/issue/github-repository-issue.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			OrganizationGithubRepository,
			OrganizationGithubRepositoryIssue
		]),
		HttpModule,
		TenantModule,
		UserModule,
		forwardRef(() => OrganizationProjectModule),
		forwardRef(() => IntegrationModule),
		forwardRef(() => IntegrationTenantModule),
		forwardRef(() => IntegrationSettingModule),
		forwardRef(() => IntegrationMapModule),
		CqrsModule
	],
	controllers: [
		GitHubAuthorizationController,
		GitHubController,
		GitHubHooksController,
		GitHubIntegrationController,
		GitHubSyncController,
		GitHubRepositoryController
	],
	providers: [
		GithubService,
		GithubSyncService,
		GithubHooksService,
		GithubRepositoryService,
		GithubRepositoryIssueService,
		// Define middleware heres
		GithubMiddleware,
		// Define handlers heres
		...CommandHandlers
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
			{
				path: '/integration/github/:integrationId/metadata',
				method: RequestMethod.GET,
			},
			{
				path: '/integration/github/:integrationId/repositories',
				method: RequestMethod.GET,
			},
			{
				path: '/integration/github/:integrationId/:owner/:repo/issues',
				method: RequestMethod.GET,
			},
			/** */
			{
				path: '/integration/github/:integrationId/auto-sync/issues',
				method: RequestMethod.POST,
			}
		); // Apply to specific routes and methods
	}
}
