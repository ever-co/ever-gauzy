import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationDocuments } from './organization-documents.entity';
import { OrganizationDocumentsService } from './organization-documents.service';
import { OrganizationDocumentsController } from './organization-documents.controler';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationDocuments])],
	providers: [OrganizationDocumentsService],
	controllers: [OrganizationDocumentsController],
	exports: [OrganizationDocumentsService]
})
export class OrganizationDocumentsModule {}
