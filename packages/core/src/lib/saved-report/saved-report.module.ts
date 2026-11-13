import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { MikroOrmSavedReportRepository } from './repository/mikro-orm-saved-report.repository';
import { TypeOrmSavedReportRepository } from './repository/type-orm-saved-report.repository';
import { SavedReportController } from './saved-report.controller';
import { SavedReport } from './saved-report.entity';
import { SavedReportService } from './saved-report.service';

/**
 * Saved reports (ever-co/ever-gauzy#11912). `RolePermissionModule` is there for `PermissionGuard`.
 */
@Module({
	imports: [TypeOrmModule.forFeature([SavedReport]), MikroOrmModule.forFeature([SavedReport]), RolePermissionModule],
	controllers: [SavedReportController],
	providers: [SavedReportService, TypeOrmSavedReportRepository, MikroOrmSavedReportRepository],
	exports: [SavedReportService]
})
export class SavedReportModule {}
