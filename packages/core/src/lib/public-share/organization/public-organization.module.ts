import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Organization, OrganizationContact, OrganizationProject } from './../../core/entities/internal';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from '../../organization/repository/mikro-orm-organization.repository';
import { TypeOrmOrganizationContactRepository } from '../../organization-contact/repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationContactRepository } from '../../organization-contact/repository/mikro-orm-organization-contact.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';
import { MikroOrmOrganizationProjectRepository } from '../../organization-project/repository/mikro-orm-organization-project.repository';
import { PublicOrganizationController } from './public-organization.controller';
import { PublicOrganizationService } from './public-organization.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Organization, OrganizationContact, OrganizationProject]),
		MikroOrmModule.forFeature([Organization, OrganizationContact, OrganizationProject])
	],
	controllers: [PublicOrganizationController],
	providers: [
		PublicOrganizationService,
		TypeOrmOrganizationRepository,
		MikroOrmOrganizationRepository,
		TypeOrmOrganizationContactRepository,
		MikroOrmOrganizationContactRepository,
		TypeOrmOrganizationProjectRepository,
		MikroOrmOrganizationProjectRepository,
		...QueryHandlers
	]
})
export class PublicOrganizationModule {}
