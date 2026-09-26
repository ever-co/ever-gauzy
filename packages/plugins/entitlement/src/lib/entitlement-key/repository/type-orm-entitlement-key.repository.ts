import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementKey } from '../entitlement-key.entity';

@Injectable()
export class TypeOrmEntitlementKeyRepository extends Repository<EntitlementKey> {
	constructor(@InjectRepository(EntitlementKey) readonly repository: Repository<EntitlementKey>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
