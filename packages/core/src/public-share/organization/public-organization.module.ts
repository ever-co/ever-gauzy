import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization, OrganizationContact } from './../../core/entities/internal';
import { PublicOrganizationController } from './public-organization.controller';
import { PublicOrganizationService } from './public-organization.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([
			Organization,
			OrganizationContact
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
export class PublicOrganizationModule {}