import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollRun } from '../payroll-run.entity';

@Injectable()
export class TypeOrmPayrollRunRepository extends Repository<PayrollRun> {
	constructor(@InjectRepository(PayrollRun) readonly repository: Repository<PayrollRun>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
