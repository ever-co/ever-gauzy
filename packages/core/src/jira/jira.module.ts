import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { JiraController } from './jira.controller';

@Module({
	imports: [RouterModule.forRoutes([{ path: '/jira', module: JiraModule }])],
	controllers: [JiraController],
	providers: [],
	exports: []
})
export class JiraModule {}
