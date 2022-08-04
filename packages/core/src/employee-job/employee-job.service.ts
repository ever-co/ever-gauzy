import { environment as env } from '@gauzy/config';
import { Injectable } from '@nestjs/common';
import { faker } from '@ever-co/faker';
import { GauzyAIService } from '@gauzy/integration-ai';
import {
	IApplyJobPostInput,
	ICountry,
	IEmployee,
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IPagination,
	IUpdateEmployeeJobPostAppliedResult,
	IVisibilityJobPostInput,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/contracts';
import { EmployeeService } from '../employee/employee.service';
import { CountryService } from './../country/country.service';
import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService,
		private readonly countryService: CountryService
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
					jobs = await this.getRandomEmployeeJobPosts(
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
				jobs = await this.getRandomEmployeeJobPosts(
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

	private async getRandomEmployeeJobPosts(
		employees?: IEmployee[],
		page = 0,
		limit = 10
	): Promise<IPagination<IEmployeeJobPost>> {
		const { items : countries = [] as ICountry[] } = await this.countryService.findAll();

		const employeesJobs: EmployeeJobPost[] = [];
		for (let i = 0; i < limit; i++) {
			const employee = faker.random.arrayElement(employees);
			const jobPostEmployee = new EmployeeJobPost({
				employeeId: employee ? employee.id : null,
				employee: employee
			});

			const job = new JobPost({
				country: faker.random.arrayElement(countries).isoCode,
				category: faker.name.jobTitle(),
				title: faker.lorem.sentence(),
				description: faker.lorem.sentences(3),
				jobDateCreated: faker.date.past(0.1),
				jobStatus: faker.random.arrayElement(
					Object.values(JobPostStatusEnum)
				),
				jobSource: faker.random.arrayElement(
					Object.values(JobPostSourceEnum)
				),
				jobType: faker.random.arrayElement(Object.values(JobPostTypeEnum))
			});

			jobPostEmployee.jobPost = job;
			employeesJobs.push(jobPostEmployee);
		}
		return {
			items: employeesJobs,
			total: 100
		};
	}
}
