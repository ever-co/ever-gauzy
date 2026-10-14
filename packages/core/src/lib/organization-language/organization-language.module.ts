import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationLanguage } from './organization-language.entity';
import { OrganizationLanguageController } from './organization-language.controller';
import { OrganizationLanguageResolver } from './organization-language.resolver';
import { OrganizationLanguageService } from './organization-language.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationLanguageRepository } from './repository/type-orm-organization-language.repository';
import { MikroOrmOrganizationLanguageRepository } from './repository/mikro-orm-organization-language.repository';

/**
 * The languages an organization works in.
 *
 * The resolver is declared here, beside the service it calls, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach. The service is exported so the
 * module that hosts the resolver graph receives it through this module's own export rather than
 * reaching into the container.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationLanguage]),
		MikroOrmModule.forFeature([OrganizationLanguage]),
		RolePermissionModule
	],
	controllers: [OrganizationLanguageController],
	providers: [
		OrganizationLanguageService,
		// The GraphQL view of the same resource.
		OrganizationLanguageResolver,
		TypeOrmOrganizationLanguageRepository,
		MikroOrmOrganizationLanguageRepository
	],
	exports: [
		OrganizationLanguageService,
		TypeOrmOrganizationLanguageRepository,
		MikroOrmOrganizationLanguageRepository
	]
})
export class OrganizationLanguageModule {}
