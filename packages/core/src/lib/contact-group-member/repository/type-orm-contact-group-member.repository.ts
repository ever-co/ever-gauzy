import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactGroupMember } from '../contact-group-member.entity';

@Injectable()
export class TypeOrmContactGroupMemberRepository extends Repository<ContactGroupMember> {
	constructor(@InjectRepository(ContactGroupMember) readonly repository: Repository<ContactGroupMember>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
