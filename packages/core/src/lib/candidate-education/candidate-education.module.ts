import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { CandidateEducationController } from './candidate-education.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateEducationRepository } from './repository/type-orm-candidate-education.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateEducation]),
		MikroOrmModule.forFeature([CandidateEducation]),
		RolePermissionModule
	],
	controllers: [CandidateEducationController],
	providers: [CandidateEducationService, TypeOrmCandidateEducationRepository]
})
export class CandidateEducationModule {}
