import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollItem } from '../payroll-item.entity';

@Injectable()
export class TypeOrmPayrollItemRepository extends Repository<PayrollItem> {
	constructor(@InjectRepository(PayrollItem) readonly repository: Repository<PayrollItem>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
