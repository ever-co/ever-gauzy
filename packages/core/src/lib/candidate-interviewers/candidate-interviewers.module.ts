import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/candidate-interviewers',
				module: CandidateInterviewersModule
			}
		]),
		TypeOrmModule.forFeature([CandidateInterviewers]),
		MikroOrmModule.forFeature([CandidateInterviewers]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [CandidateInterviewersController],
	providers: [CandidateInterviewersService, ...CommandHandlers],
	exports: [CandidateInterviewersService]
})
export class CandidateInterviewersModule {}
