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

	async getAllTimeOffRequests(relations, findInput?, filterDate?) {
		const allRequests = await this.timeOfRequestRepository.find({ where: findInput['organziationId'], relations });
		let items = [];
		const total = await this.timeOfRequestRepository.count();

		if (findInput['employeeId']) {
			allRequests.forEach(request => {
				request.employees.forEach(e => {
					if (e.id === findInput['employeeId']) {
						items.push(request)
					}
				})
			})
		} else {
			items = allRequests;
		}

		if (filterDate) {
			const dateObject = new Date(filterDate);

			const month = dateObject.getMonth() + 1;
			const year = dateObject.getFullYear();

			items = [...items].filter((i) => {
				const currentItemMonth = i.start.getMonth() + 1;
				const currentItemYear = i.start.getFullYear();
				return currentItemMonth === month && currentItemYear === year;
			});
		}

		return { items, total };
	}
}
