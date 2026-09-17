import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingProfileVariant } from '../shipping-profile-variant.entity';

@Injectable()
export class TypeOrmShippingProfileVariantRepository extends Repository<ShippingProfileVariant> {
	constructor(@InjectRepository(ShippingProfileVariant) readonly repository: Repository<ShippingProfileVariant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}