import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagType } from '../tag-type.entity';

@Injectable()
export class TypeOrmTagTypeRepository extends Repository<TagType> {
	constructor(@InjectRepository(TagType) readonly repository: Repository<TagType>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
