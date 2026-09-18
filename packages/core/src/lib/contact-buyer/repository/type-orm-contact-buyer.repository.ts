import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactBuyer } from '../contact-buyer.entity';

@Injectable()
export class TypeOrmContactBuyerRepository extends Repository<ContactBuyer> {
	constructor(@InjectRepository(ContactBuyer) readonly repository: Repository<ContactBuyer>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
