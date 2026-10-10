import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaign.entity';

/**
 * TypeORM repository of Campaign. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<Campaign>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmCampaignRepository extends Repository<Campaign> {
	constructor(@InjectRepository(Campaign) readonly repository: Repository<Campaign>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
