import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
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
		TenantModule,
		RolePermissionModule,
		UserModule,
		CqrsModule
	],
	controllers: [CandidateInterviewersController],
	providers: [CandidateInterviewersService, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, CandidateInterviewersService]
})
export class CandidateInterviewersModule { }
