import { Injectable } from '@nestjs/common';
import { IPagination } from '../core';
import { getRandomEmployeeJobPosts } from './employee-job.seed';
import { GauzyAIService } from '@gauzy/integration-ai';
import { Employee } from '../employee/employee.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmployeeJobPost, IGetEmployeeJobPostInput } from '@gauzy/models';
import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		private readonly gauzyAIService: GauzyAIService
	) {}

	public async findAll(
		data: IGetEmployeeJobPostInput
	): Promise<IPagination<IEmployeeJobPost>> {
		const employees = await this.employeeRepository.find({
			relations: ['user']
		});

		let jobs: IPagination<IEmployeeJobPost>;

		// TODO: we should check here if we have Gauzy AI endpoint in the tenant settings.
		// If we don't have, we should use Random Seeds. Only if it's development environment, not in production!!!
		// In production it should just return null if Gauzy AI not configured

		// TODO: replace true with check of .env setting for GauzyAIGraphQLEndpoint
		if (false) {
			const result = await this.gauzyAIService.getEmployeesJobPosts();

			const jobsResponse = result.data.employeeJobPosts.edges;

			const jobsConverted = await Promise.all(
				jobsResponse.map(async (jo) => {
					// TODO: here should be code to find one employee by j.employee.externalEmployeeId.
					// But because that values come for now as null, we just use first employee for now
					const employee = employees[0];

					const j = jo.node;
					const job = new EmployeeJobPost();

					job.employee = employee;
					job.employeeId = employee.id;

					job.isApplied = j.isApplied;
					job.appliedDate = j.appliedDate;

					job.jobPostId = j.jobPost.id;
					job.jobPost = <JobPost>j.jobPost;

					return job;
				})
			);

			// TODO: filter jobsConverted using data.page and data.limit

			jobs = {
				items: jobsConverted,
				total: jobsConverted.length
			};

			// TODO: this jobs contains tons of GraphQL related fields. We should convert all that into Gauzy EmployeeJobPost and JobPost entities!
			// I.e. here should be mapping, we don't want to return result of GraphQL query here as is!
		} else {
			jobs = await getRandomEmployeeJobPosts(
				employees,
				data.page,
				data.limit
			);
		}

		return jobs;
	}
}
