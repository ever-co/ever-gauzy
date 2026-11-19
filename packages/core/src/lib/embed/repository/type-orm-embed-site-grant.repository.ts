import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbedSiteGrant } from '../embed-site-grant.entity';

@Injectable()
export class TypeOrmEmbedSiteGrantRepository extends Repository<EmbedSiteGrant> {
	constructor(@InjectRepository(EmbedSiteGrant) readonly repository: Repository<EmbedSiteGrant>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
