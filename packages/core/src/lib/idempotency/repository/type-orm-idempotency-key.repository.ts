import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from '../idempotency-key.entity';

@Injectable()
export class TypeOrmIdempotencyKeyRepository extends Repository<IdempotencyKey> {
	constructor(@InjectRepository(IdempotencyKey) readonly repository: Repository<IdempotencyKey>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
