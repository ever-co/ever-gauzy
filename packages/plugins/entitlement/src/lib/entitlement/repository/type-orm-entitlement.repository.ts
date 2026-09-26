import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement } from '../entitlement.entity';

@Injectable()
export class TypeOrmEntitlementRepository extends Repository<Entitlement> {
	constructor(@InjectRepository(Entitlement) readonly repository: Repository<Entitlement>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
