import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationLanguage } from './organization-language.entity';
import { OrganizationLanguageController } from './organization-language.controller';
import { OrganizationLanguageService } from './organization-language.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-languages',
				module: OrganizationLanguageModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationLanguage]),
		TenantModule
	],
	controllers: [OrganizationLanguageController],
	providers: [OrganizationLanguageService],
	exports: [OrganizationLanguageService]
})
export class OrganizationLanguageModule {}
