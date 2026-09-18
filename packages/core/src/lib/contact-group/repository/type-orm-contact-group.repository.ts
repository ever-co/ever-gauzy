import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactGroup } from '../contact-group.entity';

@Injectable()
export class TypeOrmContactGroupRepository extends Repository<ContactGroup> {
	constructor(@InjectRepository(ContactGroup) readonly repository: Repository<ContactGroup>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
