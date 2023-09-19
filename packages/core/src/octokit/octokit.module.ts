import { Module } from '@nestjs/common';
import { OctokitController } from './octokit.controller';
import { OctokitService } from './octokit.service';
import { RouterModule } from 'nest-router';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/octokit', module: OctokitModule }]),
	],

	controllers: [OctokitController],
	providers: [OctokitService],
	exports: [OctokitService],
})
export class OctokitModule {}
