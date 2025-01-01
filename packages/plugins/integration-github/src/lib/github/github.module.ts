import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module, NestModule, RequestMethod, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
	IntegrationMapModule,
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	OrganizationProjectModule,
	PluginCommonModule,
	RolePermissionModule
} from '@gauzy/core';
import { ConfigModule, environment } from '@gauzy/config';
import { ProbotModule } from '../probot/probot.module';
import { CommandHandlers } from './commands/handlers';
import { GithubEventSubscriber } from './github-event.subscriber';
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
import { TypeOrmOrganizationGithubRepositoryRepository } from './repository/repository/type-orm-organization-github-repository.repository';
import { TypeOrmOrganizationGithubRepositoryIssueRepository } from './repository/issue/repository/type-orm-github-repository-issue.repository';
import { MikroOrmOrganizationGithubRepositoryRepository } from './repository/repository/mikro-orm-organization-github-repository.repository';
import { MikroOrmOrganizationGithubRepositoryIssueRepository } from './repository/issue/repository/mikro-orm-github-repository-issue.repository';

// Import the Probot configuration module
const { github } = environment;

@Module({
	imports: [
		HttpModule,
		ConfigModule,
		TypeOrmModule.forFeature([
			OrganizationGithubRepository,
			OrganizationGithubRepositoryIssue
		]),
		MikroOrmModule.forFeature([
			OrganizationGithubRepository,
			OrganizationGithubRepositoryIssue
		]),
		// Probot Configuration
		ProbotModule.forRoot({
			isGlobal: true,
			// Webhook URL in GitHub will be: https://api.gauzy.co/api/integration/github/webhook
			path: 'integration/github/webhook',
			config: {
				/** Client Configuration */
				clientId: github.clientId,
				clientSecret: github.clientSecret,
				appId: github.appId,
				privateKey: github.appPrivateKey,
				webhookSecret: github.webhookSecret
			}
		}),
		PluginCommonModule,
		RolePermissionModule,
		CqrsModule,
		forwardRef(() => OrganizationProjectModule),
		forwardRef(() => IntegrationModule),
		forwardRef(() => IntegrationTenantModule),
		forwardRef(() => IntegrationSettingModule),
		forwardRef(() => IntegrationMapModule),

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
		// Define middleware heres
		GithubMiddleware,
		// Define services heres
		GithubEventSubscriber,
		GithubService,
		GithubSyncService,
		GithubHooksService,
		GithubRepositoryService,
		GithubRepositoryIssueService,
		// Define repositories heres
		TypeOrmOrganizationGithubRepositoryRepository,
		MikroOrmOrganizationGithubRepositoryRepository,
		TypeOrmOrganizationGithubRepositoryIssueRepository,
		MikroOrmOrganizationGithubRepositoryIssueRepository,
		// Define handlers heres
		...CommandHandlers
	],
	exports: [TypeOrmOrganizationGithubRepositoryRepository, TypeOrmOrganizationGithubRepositoryIssueRepository]
})
export class GithubModule implements NestModule {
	/**
	 * Configures middleware for specific routes.
	 *
	 * @param consumer - The middleware consumer to apply the middlewares.
	 */
	configure(consumer: MiddlewareConsumer) {
		// Apply the GithubMiddleware to specific routes
		consumer.apply(GithubMiddleware).forRoutes(
			// Define routes and HTTP methods for which the middleware should be applied
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
			},
			{
				path: '/integration/github/:integrationId/manual-sync/issues',
				method: RequestMethod.POST
			},
			{
				path: '/integration/github/:integrationId/auto-sync/issues',
				method: RequestMethod.POST
			}
		); // Apply the middleware to specific routes and methods
	}
}
