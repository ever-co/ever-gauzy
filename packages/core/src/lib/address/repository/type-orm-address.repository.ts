import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../address.entity';

@Injectable()
export class TypeOrmAddressRepository extends Repository<Address> {
	constructor(@InjectRepository(Address) readonly repository: Repository<Address>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
