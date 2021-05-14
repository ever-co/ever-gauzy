import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { ReportCategory } from './report-category.entity';
import { Report } from './report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { TenantModule } from '../tenant/tenant.module';
import { ReportCategoryController } from './report-category.controller';
import { ReportCategoryService } from './report-category.service';
import { ReportOrganization } from './report-organization.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ 
				path: '/report', 
				module: ReportModule 
			}
		]),
		TypeOrmModule.forFeature([
			Report, 
			ReportCategory, 
			ReportOrganization
		]),
		TenantModule
	],
	controllers: [ReportCategoryController, ReportController],
	providers: [
		ReportService, 
		ReportCategoryService,
		...CommandHandlers
	]
})
export class ReportModule {}
