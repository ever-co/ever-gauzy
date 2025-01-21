import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CandidateTechnologiesController } from './candidate-technologies.controller';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CommandHandlers } from './commands/handlers';
import { CandidateTechnologies } from './../core/entities/internal';
import { TypeOrmCandidateTechnologiesRepository } from './repository/type-orm-candidate-technologies.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateTechnologies]),
		MikroOrmModule.forFeature([CandidateTechnologies]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [CandidateTechnologiesController],
	providers: [CandidateTechnologiesService, TypeOrmCandidateTechnologiesRepository, ...CommandHandlers],
	exports: [CandidateTechnologiesService]
})
export class CandidateTechnologiesModule {}
