import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbedAllowedOrigin } from '../embed-allowed-origin.entity';

@Injectable()
export class TypeOrmEmbedAllowedOriginRepository extends Repository<EmbedAllowedOrigin> {
	constructor(@InjectRepository(EmbedAllowedOrigin) readonly repository: Repository<EmbedAllowedOrigin>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
