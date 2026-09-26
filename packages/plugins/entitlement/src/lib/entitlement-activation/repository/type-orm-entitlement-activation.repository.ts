import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementActivation } from '../entitlement-activation.entity';

@Injectable()
export class TypeOrmEntitlementActivationRepository extends Repository<EntitlementActivation> {
	constructor(@InjectRepository(EntitlementActivation) readonly repository: Repository<EntitlementActivation>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
