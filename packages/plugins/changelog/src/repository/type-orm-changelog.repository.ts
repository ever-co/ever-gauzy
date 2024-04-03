import { Repository } from 'typeorm';
import { Changelog } from '../changelog.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmChangelogRepository extends Repository<Changelog> {
	constructor(@InjectRepository(Changelog) readonly repository: Repository<Changelog>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
