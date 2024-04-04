import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Screenshot } from '../screenshot.entity';

@Injectable()
export class TypeOrmScreenshotRepository extends Repository<Screenshot> {
	constructor(@InjectRepository(Screenshot) readonly repository: Repository<Screenshot>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
