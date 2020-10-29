import { environment as env } from '@env-api/environment';
import { Injectable } from '@nestjs/common';
import { IPagination } from '../core';
import { getRandomEmployeeJobPosts } from './employee-job.seed';
import { GauzyAIService } from '@gauzy/integration-ai';
import { Employee } from '../employee/employee.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IApplyJobPostInput,
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IUpdateEmployeeJobPostAppliedResult,
	IVisibilityJobPostInput
} from '@gauzy/models';
import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		private readonly gauzyAIService: GauzyAIService
	) {}

	/**
	 * Updates job visibility
	 * @param hide Should job be hidden or visible. This will set isActive field to false in Gauzy AI
	 * @param employeeId If employeeId set, job will be set not active only for that specific employee (using EmployeeJobPost record update in Gauzy AI)
	 * If employeeId is not set, job will be set not active for all employees (using JobPost record update in Gauzy AI)
	 * @param providerCode e.g. 'upwork'
	 * @param providerJobId Unique job id in the provider, e.g. in Upwork
	 */
	public async updateVisibility(
		input: IVisibilityJobPostInput
	): Promise<boolean> {
		const { hide = true, employeeId, providerCode, providerJobId } = input;
		return true;
	}

	/**
	 * Updates if Employee Applied to a job
	 * @param applied This will set isApplied and appliedDate fields in Gauzy AI
	 * @param employeeId Employee who applied for a job
	 * @param providerCode e.g. 'upwork'
	 * @param providerJobId Unique job id in the provider, e.g. in Upwork
	 */
	public async updateApplied(
		input: IApplyJobPostInput
	): Promise<IUpdateEmployeeJobPostAppliedResult> {
		const {
			applied = true,
			employeeId,
			providerCode,
			providerJobId
		} = input;
		return {
			isRedirectRequired: true
		};
	}

	/**
	 * Find all available Jobs matched to Gauzy Employees
	 * @param data
	 */
	public async findAll(
		data: IGetEmployeeJobPostInput
	): Promise<IPagination<IEmployeeJobPost>> {
		const employees = await this.employeeRepository.find({
			relations: ['user']
		});

		let jobs: IPagination<IEmployeeJobPost>;

		if (env.gauzyAIGraphQLEndpoint) {
			const result = await this.gauzyAIService.getEmployeesJobPosts();

			if (result === null) {
				if (env.production) {
					// OK, so for some reason connection go Gauzy AI failed, we can't get jobs ...
					jobs = {
						items: [],
						total: 0
					};
				} else {
					// In development, even if connection failed, we want to show fake jobs in UI
					jobs = await getRandomEmployeeJobPosts(
						employees,
						data.page,
						data.limit
					);
				}
			} else {
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
			}
		} else {
			// If it's production, we should return empty here because we don't want fake jobs in production
			if (env.production === false) {
				jobs = await getRandomEmployeeJobPosts(
					employees,
					data.page,
					data.limit
				);
			} else {
				jobs = {
					items: [],
					total: 0
				};
			}
		}

		return jobs;
	}
}
