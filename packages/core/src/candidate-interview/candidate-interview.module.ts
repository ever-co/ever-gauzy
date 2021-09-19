import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CandidateInterviewService } from './candidate-interview.service';
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterview } from './candidate-interview.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate-interview', module: CandidateInterviewModule }
		]),
		TypeOrmModule.forFeature([ CandidateInterview ]),
		TenantModule,
		UserModule
	],
	providers: [CandidateInterviewService],
	controllers: [CandidateInterviewController],
	exports: [TypeOrmModule, CandidateInterviewService]
})
export class CandidateInterviewModule {}
