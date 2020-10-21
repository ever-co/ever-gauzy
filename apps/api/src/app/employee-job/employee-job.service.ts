import { Injectable } from '@nestjs/common';
import { IPagination } from '../core';
import { EmployeeJobPost } from './employee-job.entity';
import { getRandomEmployeeJobPosts } from './employee-job.seed';

@Injectable()
export class EmployeeJobPostService {
	public async findAll({
		where,
		relations
	}): Promise<IPagination<EmployeeJobPost>> {
		// TODO: we should check here if we can connect to Gauzy AI.
		// If we can't connect to Gauzy AI, we should use Random Seeds (only if it's development environment, not in production)

		const jobs = await getRandomEmployeeJobPosts();

		return {
			items: jobs,
			total: jobs.length
		};
	}
}
