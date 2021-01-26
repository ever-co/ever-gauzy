import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationLanguages } from './organization-languages.entity';
import { OrganizationLanguagesController } from './organization-languages.controller';
import { OrganizationLanguagesService } from './organization-languages.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationLanguages]), TenantModule],
	controllers: [OrganizationLanguagesController],
	providers: [OrganizationLanguagesService],
	exports: [OrganizationLanguagesService]
})
export class OrganizationLanguagesModule {}
