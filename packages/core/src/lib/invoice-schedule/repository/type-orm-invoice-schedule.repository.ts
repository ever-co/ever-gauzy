import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceSchedule } from '../invoice-schedule.entity';

@Injectable()
export class TypeOrmInvoiceScheduleRepository extends Repository<InvoiceSchedule> {
	constructor(@InjectRepository(InvoiceSchedule) readonly repository: Repository<InvoiceSchedule>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
