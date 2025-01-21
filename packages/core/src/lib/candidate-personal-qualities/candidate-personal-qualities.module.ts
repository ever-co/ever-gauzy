import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { CandidatePersonalQualitiesController } from './candidate-personal-qualities.controller';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidatePersonalQualitiesRepository } from './repository/type-orm-candidate-personal-qualities.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidatePersonalQualities]),
		MikroOrmModule.forFeature([CandidatePersonalQualities]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [CandidatePersonalQualitiesController],
	providers: [CandidatePersonalQualitiesService, TypeOrmCandidatePersonalQualitiesRepository, ...CommandHandlers],
	exports: [CandidatePersonalQualitiesService]
})
export class CandidatePersonalQualitiesModule {}
