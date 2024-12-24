import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from '../dashboard.entity';

@Injectable()
export class TypeOrmDashboardRepository extends Repository<Dashboard> {
	constructor(@InjectRepository(Dashboard) readonly repository: Repository<Dashboard>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
