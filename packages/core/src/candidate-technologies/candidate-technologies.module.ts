import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';
import { CandidateTechnologiesController } from './candidate-technologies.controller';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CommandHandlers } from './commands/handlers';
import { CandidateTechnologies } from './../core/entities/internal';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/candidate-technologies',
				module: CandidateTechnologiesModule
			}
		]),
		TypeOrmModule.forFeature([CandidateTechnologies]),
		MikroOrmModule.forFeature([CandidateTechnologies]),
		TenantModule,
		CqrsModule
	],
	providers: [CandidateTechnologiesService, ...CommandHandlers],
	controllers: [CandidateTechnologiesController],
	exports: [CandidateTechnologiesService]
})
export class CandidateTechnologiesModule { }
