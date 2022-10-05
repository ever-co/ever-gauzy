import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateEducationController } from './candidate-education.controller';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate-educations', module: CandidateEducationModule }
		]),
		TypeOrmModule.forFeature([
			CandidateEducation
		]),
		TenantModule,
		UserModule
	],
	controllers: [CandidateEducationController],
	providers: [CandidateEducationService],
	exports: [
		TypeOrmModule,
		CandidateEducationService
	]
})
export class CandidateEducationModule {}
