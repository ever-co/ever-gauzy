import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedReport } from '../saved-report.entity';

@Injectable()
export class TypeOrmSavedReportRepository extends Repository<SavedReport> {
	constructor(@InjectRepository(SavedReport) readonly repository: Repository<SavedReport>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
