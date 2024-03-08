import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';
import { OrganizationDocumentController } from './organization-document.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-documents',
				module: OrganizationDocumentModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationDocument]),
		MikroOrmModule.forFeature([OrganizationDocument]),
		RolePermissionModule
	],
	providers: [OrganizationDocumentService],
	controllers: [OrganizationDocumentController],
	exports: [TypeOrmModule, MikroOrmModule]
})
export class OrganizationDocumentModule { }
