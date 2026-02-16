import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from '../../entities/token.entity';

@Injectable()
export class TypeOrmTokenRepository extends Repository<Token> {
	constructor(@InjectRepository(Token) readonly repository: Repository<Token>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
