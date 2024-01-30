import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

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
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [CandidateInterviewersController],
	providers: [CandidateInterviewersService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, CandidateInterviewersService]
})
export class CandidateInterviewersModule { }
