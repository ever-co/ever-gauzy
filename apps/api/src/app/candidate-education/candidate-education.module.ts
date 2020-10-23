import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateEducationController } from './candidate-education.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateEducation]), TenantModule],
	providers: [CandidateEducationService],
	controllers: [CandidateEducationController],
	exports: [CandidateEducationService]
})
export class CandidateEducationModule {}
