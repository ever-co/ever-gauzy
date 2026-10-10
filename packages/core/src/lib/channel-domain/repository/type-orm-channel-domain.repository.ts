import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelDomain } from '../channel-domain.entity';

@Injectable()
export class TypeOrmChannelDomainRepository extends Repository<ChannelDomain> {
	constructor(@InjectRepository(ChannelDomain) readonly repository: Repository<ChannelDomain>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
