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
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';

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
		TypeOrmReportRepository,
		TypeOrmReportOrganizationRepository,
		...CommandHandlers
	]
})
export class ReportModule {}
