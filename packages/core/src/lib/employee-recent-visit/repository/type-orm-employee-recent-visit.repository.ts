import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecentVisit } from '../employee-recent-visit.entity';

@Injectable()
export class TypeOrmEmployeeRecentVisitRepository extends Repository<EmployeeRecentVisit> {
	constructor(@InjectRepository(EmployeeRecentVisit) readonly repository: Repository<EmployeeRecentVisit>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
