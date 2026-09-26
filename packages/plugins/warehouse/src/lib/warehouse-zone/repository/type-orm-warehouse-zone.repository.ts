import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseZone } from '../warehouse-zone.entity';

@Injectable()
export class TypeOrmWarehouseZoneRepository extends Repository<WarehouseZone> {
	constructor(@InjectRepository(WarehouseZone) readonly repository: Repository<WarehouseZone>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
