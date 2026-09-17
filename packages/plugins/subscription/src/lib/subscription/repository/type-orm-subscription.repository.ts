import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../subscription.entity';

@Injectable()
export class TypeOrmSubscriptionRepository extends Repository<Subscription> {
	constructor(@InjectRepository(Subscription) readonly repository: Repository<Subscription>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
