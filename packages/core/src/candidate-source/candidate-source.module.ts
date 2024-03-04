import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateSourceService } from './candidate-source.service';
import { CandidateSource } from './candidate-source.entity';
import { CandidateSourceController } from './candidate-source.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-source', module: CandidateSourceModule }]),
		TypeOrmModule.forFeature([CandidateSource]),
		MikroOrmModule.forFeature([CandidateSource]),
		RolePermissionModule
	],
	providers: [CandidateSourceService],
	controllers: [CandidateSourceController],
	exports: [CandidateSourceService]
})
export class CandidateSourceModule { }
