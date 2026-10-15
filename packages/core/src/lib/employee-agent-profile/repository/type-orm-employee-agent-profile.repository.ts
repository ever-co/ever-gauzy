import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAgentProfile } from '../employee-agent-profile.entity';

@Injectable()
export class TypeOrmEmployeeAgentProfileRepository extends Repository<EmployeeAgentProfile> {
	constructor(@InjectRepository(EmployeeAgentProfile) readonly repository: Repository<EmployeeAgentProfile>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
