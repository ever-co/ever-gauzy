import { Module } from '@nestjs/common';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';
import { RouterModule } from 'nest-router';
import { ProbotModule } from '@gauzy/integration-github';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/github', module: GitHubModule }]),
		ProbotModule,
	],

	controllers: [GitHubController],
	providers: [GitHubService],
	exports: [GitHubService],
})
export class GitHubModule {}
