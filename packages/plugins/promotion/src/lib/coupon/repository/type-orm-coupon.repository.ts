import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from '../coupon.entity';

/**
 * TypeORM repository of Coupon. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<Coupon>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmCouponRepository extends Repository<Coupon> {
	constructor(@InjectRepository(Coupon) readonly repository: Repository<Coupon>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
