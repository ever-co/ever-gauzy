import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { CandidatePersonalQualitiesController } from './candidate-personal-qualities.controller';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/candidate-personal-qualities',
				module: CandidatePersonalQualitiesModule
			}
		]),
		TypeOrmModule.forFeature([CandidatePersonalQualities]),
		MikroOrmModule.forFeature([CandidatePersonalQualities]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [CandidatePersonalQualitiesService, ...CommandHandlers],
	controllers: [CandidatePersonalQualitiesController],
	exports: [TypeOrmModule, MikroOrmModule, CandidatePersonalQualitiesService]
})
export class CandidatePersonalQualitiesModule { }
