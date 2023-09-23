import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from 'tenant/tenant.module';
import { UserModule } from 'user/user.module';
import { IntegrationModule } from 'integration/integration.module';
import { GitHubAuthorizationController } from './github-authorization.controller';
import { GitHubController } from './github.controller';
import { GitHubIntegrationController } from './github-integration.controller';
import { GitHubHooksController } from './github.events.controller';
import { GithubService } from './github.service';
import { GithubHooksService } from './github.events.service';

@Module({
	imports: [
		HttpModule,
		TenantModule,
		UserModule,
		CqrsModule,
		forwardRef(() => IntegrationModule)
	],
	controllers: [
		GitHubAuthorizationController,
		GitHubController,
		GitHubIntegrationController,
		GitHubHooksController
	],
	providers: [
		GithubService,
		GithubHooksService
	],
	exports: [
		GithubService,
		GithubHooksService
	],
})
export class GithubModule { }
