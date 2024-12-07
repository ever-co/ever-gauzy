import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../favorite.entity';

@Injectable()
export class TypeOrmFavoriteRepository extends Repository<Favorite> {
	constructor(@InjectRepository(Favorite) readonly repository: Repository<Favorite>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
