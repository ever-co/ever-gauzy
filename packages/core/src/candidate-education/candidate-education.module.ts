import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateEducationController } from './candidate-education.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-educations', module: CandidateEducationModule }]),
		TypeOrmModule.forFeature([CandidateEducation]),
		MikroOrmModule.forFeature([CandidateEducation]),
		RolePermissionModule
	],
	controllers: [CandidateEducationController],
	providers: [CandidateEducationService],
	exports: [TypeOrmModule, MikroOrmModule, CandidateEducationService]
})
export class CandidateEducationModule { }
