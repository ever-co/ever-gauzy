import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { CrudService } from '../core/crud/crud.service';
import { TimeOffCreateInput as ITimeOffCreateInput } from '@gauzy/models';

@Injectable()
export class TimeOffRequestService extends CrudService<TimeOffRequest> {
	constructor(
		@InjectRepository(TimeOffRequest)
		private readonly timeOfRequestRepository: Repository<TimeOffRequest>
	) {
		super(timeOfRequestRepository);
	}

	async create(entity: ITimeOffCreateInput): Promise<TimeOffRequest> {
		const request = new TimeOffRequest();
		Object.assign(request, entity);

		return await this.timeOfRequestRepository.save(request);
	}
}
