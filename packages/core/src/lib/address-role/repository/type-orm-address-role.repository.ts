import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressRole } from '../address-role.entity';

@Injectable()
export class TypeOrmAddressRoleRepository extends Repository<AddressRole> {
	constructor(@InjectRepository(AddressRole) readonly repository: Repository<AddressRole>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
