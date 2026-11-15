import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceScheduleRun } from '../invoice-schedule-run.entity';

@Injectable()
export class TypeOrmInvoiceScheduleRunRepository extends Repository<InvoiceScheduleRun> {
	constructor(@InjectRepository(InvoiceScheduleRun) readonly repository: Repository<InvoiceScheduleRun>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
