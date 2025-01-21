import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateExperience } from './candidate-experience.entity';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperienceController } from './candidate-experience.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateExperienceRepository } from './repository/type-orm-candidate-experience.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateExperience]),
		MikroOrmModule.forFeature([CandidateExperience]),
		RolePermissionModule
	],
	providers: [CandidateExperienceService, TypeOrmCandidateExperienceRepository],
	controllers: [CandidateExperienceController]
})
export class CandidateExperienceModule {}
