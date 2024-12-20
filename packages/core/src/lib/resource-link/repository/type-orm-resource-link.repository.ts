import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceLink } from '../resource-link.entity';

@Injectable()
export class TypeOrmResourceLinkRepository extends Repository<ResourceLink> {
	constructor(@InjectRepository(ResourceLink) readonly repository: Repository<ResourceLink>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
