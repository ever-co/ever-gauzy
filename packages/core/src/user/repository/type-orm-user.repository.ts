import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TypeOrmUserRepository extends Repository<User> {
	constructor(@InjectRepository(User) readonly repository: Repository<User>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
