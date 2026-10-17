import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactCredential } from '../contact-credential.entity';

@Injectable()
export class TypeOrmContactCredentialRepository extends Repository<ContactCredential> {
	constructor(@InjectRepository(ContactCredential) readonly repository: Repository<ContactCredential>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
