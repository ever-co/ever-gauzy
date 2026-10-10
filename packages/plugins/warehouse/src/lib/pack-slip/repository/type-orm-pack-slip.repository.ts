import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackSlip } from '../pack-slip.entity';

@Injectable()
export class TypeOrmPackSlipRepository extends Repository<PackSlip> {
	constructor(@InjectRepository(PackSlip) readonly repository: Repository<PackSlip>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
