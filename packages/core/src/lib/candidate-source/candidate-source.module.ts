import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateSourceService } from './candidate-source.service';
import { CandidateSource } from './candidate-source.entity';
import { CandidateSourceController } from './candidate-source.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmCandidateSourceRepository } from './repository/type-orm-candidate-source.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([CandidateSource]),
		MikroOrmModule.forFeature([CandidateSource]),
		RolePermissionModule
	],
	providers: [CandidateSourceService, TypeOrmCandidateSourceRepository],
	controllers: [CandidateSourceController]
})
export class CandidateSourceModule {}
