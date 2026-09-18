import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelRegion } from '../channel-region.entity';

@Injectable()
export class TypeOrmChannelRegionRepository extends Repository<ChannelRegion> {
	constructor(@InjectRepository(ChannelRegion) readonly repository: Repository<ChannelRegion>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
