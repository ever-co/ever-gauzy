import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from '../region.entity';

@Injectable()
export class TypeOrmRegionRepository extends Repository<Region> {
	constructor(@InjectRepository(Region) readonly repository: Repository<Region>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
