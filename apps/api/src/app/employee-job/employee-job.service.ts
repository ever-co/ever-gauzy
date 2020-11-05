import { environment as env } from '@env-api/environment';
import { Injectable } from '@nestjs/common';
import { IPagination } from '../core';
import { getRandomEmployeeJobPosts } from './employee-job.seed';
import { GauzyAIService } from '@gauzy/integration-ai';
import {
	IApplyJobPostInput,
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IUpdateEmployeeJobPostAppliedResult,
	IVisibilityJobPostInput
} from '@gauzy/models';
import { EmployeeService } from '../employee/employee.service';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		private readonly employeeService: EmployeeService,
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
		return await this.gauzyAIService.updateVisibility(input);
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
		return await this.gauzyAIService.updateApplied(input);
	}

	/**
	 * Find all available Jobs matched to Gauzy Employees
	 * @param data
	 */
	public async findAll(
		data: IGetEmployeeJobPostInput
	): Promise<IPagination<IEmployeeJobPost>> {
		const employees = await this.employeeService.findAllActive();

		let jobs: IPagination<IEmployeeJobPost>;

		if (env.gauzyAIGraphQLEndpoint) {
			const result = await this.gauzyAIService.getEmployeesJobPosts(data);

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
				const jobsConverted = result.items.map((jo) => {
					if (jo.employeeId) {
						const employee = employees.find(
							(emp) => emp.id === jo.employeeId
						);
						jo.employee = employee;
					}

					return jo;
				});

				jobs = {
					items: jobsConverted,
					total: result.total
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
