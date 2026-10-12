import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseBin } from '../warehouse-bin.entity';

@Injectable()
export class TypeOrmWarehouseBinRepository extends Repository<WarehouseBin> {
	constructor(@InjectRepository(WarehouseBin) readonly repository: Repository<WarehouseBin>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
