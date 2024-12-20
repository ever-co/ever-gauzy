import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportCategory } from '../report-category.entity';

@Injectable()
export class TypeOrmReportCategoryRepository extends Repository<ReportCategory> {
    constructor(@InjectRepository(ReportCategory) readonly repository: Repository<ReportCategory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
