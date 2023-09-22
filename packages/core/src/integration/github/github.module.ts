import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { ProbotModule } from '@gauzy/integration-github';
import { TenantModule } from './../../tenant/tenant.module';
import { UserModule } from './../../user/user.module';
import { IntegrationModule } from './../../integration/integration.module';
import { GithubService } from './github.service';
import { GitHubController } from './github.controller';
import { GitHubEventsController } from './github.events.controller';
import { GitHubPostInstallController } from './github-install.controller';

@Module({
	imports: [
		HttpModule,
		TenantModule,
		UserModule,
		ProbotModule,
		CqrsModule,
		forwardRef(() => IntegrationModule)
	],
	controllers: [
		GitHubController,
		GitHubPostInstallController,
		GitHubEventsController
	],
	providers: [GithubService],
	exports: [GithubService],
})
export class GithubModule { }
