import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationDocuments } from './organization-documents.entity';
import { OrganizationDocumentsService } from './organization-documents.service';
import { OrganizationDocumentsController } from './organization-documents.controler';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationDocuments]), TenantModule],
	providers: [OrganizationDocumentsService],
	controllers: [OrganizationDocumentsController],
	exports: [TypeOrmModule]
})
export class OrganizationDocumentsModule {}
