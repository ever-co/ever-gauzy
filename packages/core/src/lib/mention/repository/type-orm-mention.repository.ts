import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mention } from '../mention.entity';

@Injectable()
export class TypeOrmMentionRepository extends Repository<Mention> {
	constructor(@InjectRepository(Mention) readonly repository: Repository<Mention>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
