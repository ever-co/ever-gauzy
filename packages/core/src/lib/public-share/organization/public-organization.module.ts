import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization, OrganizationContact, OrganizationProject } from './../../core/entities/internal';
import { PublicOrganizationController } from './public-organization.controller';
import { PublicOrganizationService } from './public-organization.service';
import { QueryHandlers } from './queries/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([
			Organization,
			OrganizationContact,
			OrganizationProject
		]),
		MikroOrmModule.forFeature([
			Organization,
			OrganizationContact,
			OrganizationProject
		]),
	],
	controllers: [
		PublicOrganizationController
	],
	providers: [
		PublicOrganizationService,
		...QueryHandlers
	],
	exports: []
})
export class PublicOrganizationModule { }
