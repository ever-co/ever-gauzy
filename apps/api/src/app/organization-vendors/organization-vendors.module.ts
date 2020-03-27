import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationVendor } from './organization-vendors.entity';
import { OrganizationVendorsController } from './organization-vendors.controller';
import { OrganizationVendorsService } from './organization-vendors.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationVendor])],
	controllers: [OrganizationVendorsController],
	providers: [OrganizationVendorsService],
	exports: [OrganizationVendorsService]
})
export class OrganizationVendorsModule {}
