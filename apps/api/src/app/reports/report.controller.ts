import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { Report } from './report.entity';
import { ReportService } from './report.service';

@ApiTags('Report')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ReportController extends CrudController<Report> {
	constructor(reportService: ReportService) {
		super(reportService);
	}
}
