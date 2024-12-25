import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video } from '../entities/video.entity';

@Injectable()
export class TypeOrmVideoRepository extends Repository<Video> {
	constructor(@InjectRepository(Video) readonly repository: Repository<Video>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
