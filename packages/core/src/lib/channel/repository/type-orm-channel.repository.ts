import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../channel.entity';

@Injectable()
export class TypeOrmChannelRepository extends Repository<Channel> {
	constructor(@InjectRepository(Channel) readonly repository: Repository<Channel>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
