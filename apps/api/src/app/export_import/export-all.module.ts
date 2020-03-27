import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService, Country } from '../country';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import {
	UserOrganizationService,
	UserOrganization
} from '../user-organization';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Country, User, UserOrganization])
	],
	controllers: [ExportAllController],
	providers: [
		ExportAllService,
		CountryService,
		UserService,
		UserOrganizationService
	],
	exports: [
		ExportAllService,
		CountryService,
		UserService,
		UserOrganizationService
	]
})
export class ExportAllModule {}
