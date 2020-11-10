import { Controller } from '@nestjs/common';
import { CrudController } from '../core';
import { Report } from './report.entity';
import { ReportService } from './report.service';

@Controller()
export class ReportController extends CrudController<Report> {
	constructor(reportService: ReportService) {
		super(reportService);
	}
}
