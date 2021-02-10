import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/candidate-documents', module: CandidateDocumentsModule }
		]),
		TypeOrmModule.forFeature([User, CandidateDocument]),
		TenantModule
	],
	providers: [CandidateDocumentsService, UserService],
	controllers: [CandidateDocumentsController],
	exports: [CandidateDocumentsService, UserService]
})
export class CandidateDocumentsModule {}
