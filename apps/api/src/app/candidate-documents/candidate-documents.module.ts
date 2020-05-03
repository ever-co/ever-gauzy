import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateDocumentsController } from './candidate-documents.controller';
import { CandidateDocument } from './candidate-documents.entity';
import { CandidateDocumentsService } from './candidate-documents.service';

@Module({
	imports: [TypeOrmModule.forFeature([CandidateDocument])],
	providers: [CandidateDocumentsService],
	controllers: [CandidateDocumentsController],
	exports: [CandidateDocumentsService]
})
export class CandidateDocumentsModule {}
