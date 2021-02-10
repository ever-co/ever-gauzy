import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/candidate-interviewers',
				module: CandidateInterviewersModule
			}
		]),
		TypeOrmModule.forFeature([CandidateInterviewers, User]),
		CqrsModule,
		TenantModule
	],
	providers: [CandidateInterviewersService, UserService, ...CommandHandlers],
	controllers: [CandidateInterviewersController],
	exports: [CandidateInterviewersService]
})
export class CandidateInterviewersModule {}
