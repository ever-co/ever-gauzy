import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';
import { OrganizationDocumentController } from './organization-document.controller';
import { OrganizationDocumentResolver } from './organization-document.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationDocumentRepository } from './repository/type-orm-organization-document.repository';
import { MikroOrmOrganizationDocumentRepository } from './repository/mikro-orm-organization-document.repository';

/**
 * The paperwork an organization keeps about itself.
 *
 * The resolver is declared here, beside the service it calls, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach. The service is exported so the
 * module that hosts the resolver graph receives it through this module's own export rather than
 * reaching into the container.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationDocument]),
		MikroOrmModule.forFeature([OrganizationDocument]),
		RolePermissionModule
	],
	controllers: [OrganizationDocumentController],
	providers: [
		OrganizationDocumentService,
		// The GraphQL view of the same resource.
		OrganizationDocumentResolver,
		TypeOrmOrganizationDocumentRepository,
		MikroOrmOrganizationDocumentRepository
	],
	exports: [
		OrganizationDocumentService,
		TypeOrmOrganizationDocumentRepository,
		MikroOrmOrganizationDocumentRepository
	]
})
export class OrganizationDocumentModule {}
