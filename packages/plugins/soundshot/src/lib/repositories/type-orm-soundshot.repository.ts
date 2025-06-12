import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Soundshot } from '../entity/soundshot.entity';

@Injectable()
export class TypeOrmSoundshotRepository extends Repository<Soundshot> {
	constructor(@InjectRepository(Soundshot) readonly repository: Repository<Soundshot>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
