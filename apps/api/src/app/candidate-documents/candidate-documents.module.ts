import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

@Module({
	imports: [TypeOrmModule.forFeature([User, CandidateDocument])],
	providers: [CandidateDocumentsService, UserService],
	controllers: [CandidateDocumentsController],
	exports: [CandidateDocumentsService, UserService]
})
export class CandidateDocumentsModule {}
