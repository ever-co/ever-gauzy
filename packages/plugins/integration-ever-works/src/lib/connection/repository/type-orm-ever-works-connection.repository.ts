import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EverWorksConnection } from '../ever-works-connection.entity';

@Injectable()
export class TypeOrmEverWorksConnectionRepository extends Repository<EverWorksConnection> {
	constructor(@InjectRepository(EverWorksConnection) readonly repository: Repository<EverWorksConnection>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
