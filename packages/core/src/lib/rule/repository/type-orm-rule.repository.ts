import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rule } from '../rule.entity';

@Injectable()
export class TypeOrmRuleRepository extends Repository<Rule> {
	constructor(@InjectRepository(Rule) readonly repository: Repository<Rule>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
