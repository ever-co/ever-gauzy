import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';
import { OrganizationDocumentController } from './organization-document.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationDocumentRepository } from './repository/type-orm-organization-document.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationDocument]),
		MikroOrmModule.forFeature([OrganizationDocument]),
		RolePermissionModule
	],
	controllers: [OrganizationDocumentController],
	providers: [OrganizationDocumentService, TypeOrmOrganizationDocumentRepository]
})
export class OrganizationDocumentModule {}
