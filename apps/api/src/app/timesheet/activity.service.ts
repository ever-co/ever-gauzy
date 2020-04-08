import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Activity } from './activity.entity';

@Injectable()
export class ActivityService extends CrudService<Activity> {
	constructor(
		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>
	) {
		super(activityRepository);
	}
}
