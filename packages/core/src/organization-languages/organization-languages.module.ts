import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationLanguages } from './organization-languages.entity';
import { OrganizationLanguagesController } from './organization-languages.controller';
import { OrganizationLanguagesService } from './organization-languages.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/organization-languages',
				module: OrganizationLanguagesModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationLanguages]),
		TenantModule
	],
	controllers: [OrganizationLanguagesController],
	providers: [OrganizationLanguagesService],
	exports: [OrganizationLanguagesService]
})
export class OrganizationLanguagesModule {}
