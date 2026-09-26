/**
 * TypeORM repository for ChannelWarehouse.
 *
 * It is a plain repository: the service composes the queries it needs, and nothing here adds
 * behaviour that a caller could bypass.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelWarehouse } from '../channel-warehouse.entity';

@Injectable()
export class TypeOrmChannelWarehouseRepository extends Repository<ChannelWarehouse> {
	constructor(@InjectRepository(ChannelWarehouse) readonly repository: Repository<ChannelWarehouse>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
