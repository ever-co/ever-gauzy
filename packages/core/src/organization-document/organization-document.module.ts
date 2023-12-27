import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';
import { OrganizationDocumentController } from './organization-document.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-documents',
				module: OrganizationDocumentModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationDocument]),
		TenantModule
	],
	providers: [OrganizationDocumentService],
	controllers: [OrganizationDocumentController],
	exports: [TypeOrmModule]
})
export class OrganizationDocumentModule {}
