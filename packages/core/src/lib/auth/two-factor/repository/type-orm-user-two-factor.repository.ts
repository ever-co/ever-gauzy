import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTwoFactor } from '../user-two-factor.entity';

@Injectable()
export class TypeOrmUserTwoFactorRepository extends Repository<UserTwoFactor> {
	constructor(@InjectRepository(UserTwoFactor) readonly repository: Repository<UserTwoFactor>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
