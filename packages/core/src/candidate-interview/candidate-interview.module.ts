import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CandidateInterviewService } from './candidate-interview.service';
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterview } from './candidate-interview.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-interview', module: CandidateInterviewModule }]),
		TypeOrmModule.forFeature([CandidateInterview]),
		MikroOrmModule.forFeature([CandidateInterview]),
		TenantModule,
		UserModule
	],
	providers: [CandidateInterviewService],
	controllers: [CandidateInterviewController],
	exports: [TypeOrmModule, MikroOrmModule, CandidateInterviewService]
})
export class CandidateInterviewModule { }
