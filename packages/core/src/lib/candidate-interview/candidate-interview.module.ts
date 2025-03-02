import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateInterviewService } from './candidate-interview.service';
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterview } from './candidate-interview.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateInterviewRepository } from './repository/type-orm-candidate-interview.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateInterview]),
		MikroOrmModule.forFeature([CandidateInterview]),
		RolePermissionModule
	],
	providers: [CandidateInterviewService, TypeOrmCandidateInterviewRepository],
	controllers: [CandidateInterviewController],
	exports: [CandidateInterviewService]
})
export class CandidateInterviewModule {}
