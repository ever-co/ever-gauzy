import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingProfile } from '../shipping-profile.entity';

@Injectable()
export class TypeOrmShippingProfileRepository extends Repository<ShippingProfile> {
	constructor(@InjectRepository(ShippingProfile) readonly repository: Repository<ShippingProfile>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}