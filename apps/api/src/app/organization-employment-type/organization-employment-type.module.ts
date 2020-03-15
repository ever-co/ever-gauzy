import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEmploymentTypeController } from './organization-employment-type.controller';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationEmploymentType])],
	controllers: [OrganizationEmploymentTypeController],
	providers: [OrganizationEmploymentTypeService],
	exports: [OrganizationEmploymentTypeService]
})
export class OrganizationEmploymentTypeModule {}
