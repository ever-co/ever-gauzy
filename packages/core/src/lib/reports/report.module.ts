import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ReportCategory } from './report-category.entity';
import { Report } from './report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportCategoryController } from './report-category.controller';
import { ReportCategoryService } from './report-category.service';
import { ReportOrganization } from './report-organization.entity';
import { CommandHandlers } from './commands/handlers';
import { ReportOrganizationService } from './report-organization.service';
import { TypeOrmReportOrganizationRepository } from './repository/type-orm-report-organization.repository';
import { MikroOrmReportOrganizationRepository } from './repository/mikro-orm-report-organization.repository';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { TypeOrmReportCategoryRepository } from './repository/type-orm-report-category.repository';
import { MikroOrmReportCategoryRepository } from './repository/mikro-orm-report-category.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Report, ReportCategory, ReportOrganization]),
		MikroOrmModule.forFeature([Report, ReportCategory, ReportOrganization])
	],
	controllers: [ReportCategoryController, ReportController],
	providers: [
		ReportService,
		ReportCategoryService,
		ReportOrganizationService,
		TypeOrmReportRepository, MikroOrmReportRepository,
		TypeOrmReportCategoryRepository, MikroOrmReportCategoryRepository,
		TypeOrmReportOrganizationRepository, MikroOrmReportOrganizationRepository,
		...CommandHandlers
	]
})
export class ReportModule {}