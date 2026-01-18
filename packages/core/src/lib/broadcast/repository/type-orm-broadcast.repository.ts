import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Broadcast } from '../broadcast.entity';

@Injectable()
export class TypeOrmBroadcastRepository extends Repository<Broadcast> {
	constructor(@InjectRepository(Broadcast) readonly repository: Repository<Broadcast>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
