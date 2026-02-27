import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationLanguage } from './organization-language.entity';
import { OrganizationLanguageController } from './organization-language.controller';
import { OrganizationLanguageService } from './organization-language.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationLanguageRepository } from './repository/type-orm-organization-language.repository';
import { MikroOrmOrganizationLanguageRepository } from './repository/mikro-orm-organization-language.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationLanguage]),
		MikroOrmModule.forFeature([OrganizationLanguage]),
		RolePermissionModule
	],
	controllers: [OrganizationLanguageController],
	providers: [OrganizationLanguageService, TypeOrmOrganizationLanguageRepository, MikroOrmOrganizationLanguageRepository]
})
export class OrganizationLanguageModule {}