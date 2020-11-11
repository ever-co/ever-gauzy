import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { ReportCategory } from './report-category.entity';

@Injectable()
export class ReportCategoryService extends CrudService<ReportCategory> {
	constructor(
		@InjectRepository(ReportCategory)
		reportRepository: Repository<ReportCategory>
	) {
		super(reportRepository);
	}
}
