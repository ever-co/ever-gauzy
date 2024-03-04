import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-documents', module: CandidateDocumentsModule }]),
		TypeOrmModule.forFeature([CandidateDocument]),
		MikroOrmModule.forFeature([CandidateDocument]),
		TenantModule,
		RolePermissionModule,
		UserModule
	],
	providers: [CandidateDocumentsService],
	controllers: [CandidateDocumentsController],
	exports: [CandidateDocumentsService]
})
export class CandidateDocumentsModule { }
