import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Report } from './report.entity';

@Injectable()
export class ReportService extends TenantAwareCrudService<Report> {
	constructor(
		@InjectRepository(Report)
		reportRepository: Repository<Report>
	) {
		super(reportRepository);
	}
}
