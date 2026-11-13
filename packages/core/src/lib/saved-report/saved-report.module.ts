import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeModule } from '../employee/employee.module';
import { RoleModule } from '../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TimeLogModule } from '../time-tracking/time-log/time-log.module';
import { UserModule } from '../user/user.module';
import { MikroOrmSavedReportRepository } from './repository/mikro-orm-saved-report.repository';
import { TypeOrmSavedReportRepository } from './repository/type-orm-saved-report.repository';
import { PublicSavedReportController } from './public-saved-report.controller';
import { SavedReportController } from './saved-report.controller';
import { SavedReport } from './saved-report.entity';
import { SavedReportPublicService } from './saved-report-public.service';
import { SavedReportService } from './saved-report.service';

/**
 * Saved reports and their read-only links (ever-co/ever-gauzy#11912). The public read runs the daily report of
 * `TimeLogModule` as the author, so it needs the user, role and employee services a sign-in uses to rebuild their
 * access. `RolePermissionModule` is there for `PermissionGuard`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([SavedReport]),
		MikroOrmModule.forFeature([SavedReport]),
		RolePermissionModule,
		RoleModule,
		UserModule,
		EmployeeModule,
		TimeLogModule
	],
	controllers: [SavedReportController, PublicSavedReportController],
	providers: [
		SavedReportService,
		SavedReportPublicService,
		TypeOrmSavedReportRepository,
		MikroOrmSavedReportRepository
	],
	exports: [SavedReportService]
})
export class SavedReportModule {}
