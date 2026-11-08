import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserApiToken } from '../user-api-token.entity';

@Injectable()
export class TypeOrmUserApiTokenRepository extends Repository<UserApiToken> {
	constructor(@InjectRepository(UserApiToken) readonly repository: Repository<UserApiToken>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
