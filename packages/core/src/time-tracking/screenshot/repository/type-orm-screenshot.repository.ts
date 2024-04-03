import { Repository } from 'typeorm';
import { Screenshot } from '../screenshot.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmScreenshotRepository extends Repository<Screenshot> {
	constructor(@InjectRepository(Screenshot) readonly repository: Repository<Screenshot>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
