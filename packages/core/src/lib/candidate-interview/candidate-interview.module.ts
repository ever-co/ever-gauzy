import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewService } from './candidate-interview.service';
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterview } from './candidate-interview.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-interview', module: CandidateInterviewModule }]),
		TypeOrmModule.forFeature([CandidateInterview]),
		MikroOrmModule.forFeature([CandidateInterview]),
		RolePermissionModule
	],
	providers: [CandidateInterviewService],
	controllers: [CandidateInterviewController],
	exports: [CandidateInterviewService]
})
export class CandidateInterviewModule {}
