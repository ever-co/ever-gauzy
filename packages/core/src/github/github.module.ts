import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { ProbotModule } from '@gauzy/integration-github';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/github', module: GitHubModule }
		]),
		ProbotModule,
	],

	controllers: [GitHubController],
	providers: [GitHubService],
	exports: [GitHubService],
})
export class GitHubModule { }
