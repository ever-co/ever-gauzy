import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { UserService } from '../user/user.service';

@Module({
	imports: [RouterModule.forRoutes([{ path: '/jira', module: JiraModule }])],
	controllers: [],
	providers: [UserService],
	exports: []
})
export class JiraModule {}
