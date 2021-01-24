import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportCategory } from './report-category.entity';
import { Report } from './report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { TenantModule } from '../tenant/tenant.module';
import { ReportCategoryController } from './report-category.controller';
import { ReportCategoryService } from './report-category.service';
import { ReportOrganization } from './report-organization.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([Report, ReportCategory, ReportOrganization]),
		TenantModule
	],
	controllers: [ReportCategoryController, ReportController],
	providers: [ReportService, ReportCategoryService]
})
export class ReportModule {}
