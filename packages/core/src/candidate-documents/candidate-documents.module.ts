import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/candidate-documents', module: CandidateDocumentsModule }]),
		TypeOrmModule.forFeature([CandidateDocument]),
		TenantModule,
		UserModule
	],
	providers: [CandidateDocumentsService],
	controllers: [CandidateDocumentsController],
	exports: [CandidateDocumentsService]
})
export class CandidateDocumentsModule {}
