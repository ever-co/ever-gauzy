import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../warehouse.entity';

@Injectable()
export class TypeOrmWarehouseRepository extends Repository<Warehouse> {
	constructor(@InjectRepository(Warehouse) readonly repository: Repository<Warehouse>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
