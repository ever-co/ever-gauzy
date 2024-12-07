import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reaction } from '../reaction.entity';

@Injectable()
export class TypeOrmReactionRepository extends Repository<Reaction> {
	constructor(@InjectRepository(Reaction) readonly repository: Repository<Reaction>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
