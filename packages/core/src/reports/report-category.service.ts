import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { ReportCategory } from './report-category.entity';
import { TypeOrmReportCategoryRepository } from './repository/type-orm-report-category.repository';
import { MikroOrmReportCategoryRepository } from './repository/mikro-orm-report-category.repository';

@Injectable()
export class ReportCategoryService extends CrudService<ReportCategory> {
	constructor(
		@InjectRepository(ReportCategory)
		typeOrmReportCategoryRepository: TypeOrmReportCategoryRepository,

		mikroOrmReportCategoryRepository: MikroOrmReportCategoryRepository
	) {
		super(typeOrmReportCategoryRepository, mikroOrmReportCategoryRepository);
	}
}
