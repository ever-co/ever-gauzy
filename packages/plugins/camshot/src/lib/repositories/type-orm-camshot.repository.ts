import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camshot } from '../entity/camshot.entity';

@Injectable()
export class TypeOrmCamshotRepository extends Repository<Camshot> {
	constructor(@InjectRepository(Camshot) readonly repository: Repository<Camshot>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
