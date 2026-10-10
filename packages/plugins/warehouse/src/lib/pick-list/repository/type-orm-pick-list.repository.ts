import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PickList } from '../pick-list.entity';

@Injectable()
export class TypeOrmPickListRepository extends Repository<PickList> {
	constructor(@InjectRepository(PickList) readonly repository: Repository<PickList>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
