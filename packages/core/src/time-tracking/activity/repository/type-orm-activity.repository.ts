import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../activity.entity';

@Injectable()
export class TypeOrmActivityRepository extends Repository<Activity> {
	constructor(@InjectRepository(Activity) readonly repository: Repository<Activity>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
