import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from '../report.entity';

@Injectable()
export class TypeOrmReportRepository extends Repository<Report> {
    constructor(@InjectRepository(Report) readonly repository: Repository<Report>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
