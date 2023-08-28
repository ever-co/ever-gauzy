import { ForbiddenException, Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { htmlToText } from 'html-to-text';
import { environment as env } from '@gauzy/config';
import { GauzyAIService, RequestConfigProvider } from '@gauzy/integration-ai';
import {
	IEmployeeJobApplication,
	ICountry,
	IEmployee,
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IPagination,
	IEmployeeJobApplicationAppliedResult,
	IUpdateEmployeeJobPostAppliedResult,
	IVisibilityJobPostInput,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum,
} from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { arrayToObject } from './../core/utils';
import { IntegrationTenantService } from './../integration-tenant/integration-tenant.service';
import { EmployeeService } from '../employee/employee.service';
import { CountryService } from './../country/country.service';
import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService,
		private readonly requestConfigProvider: RequestConfigProvider,
		private readonly countryService: CountryService,
		private readonly integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * Updates job visibility
	 * @param hide Should job be hidden or visible. This will set isActive field to false in Gauzy AI
	 * @param employeeId If employeeId set, job will be set not active only for that specific employee (using EmployeeJobPost record update in Gauzy AI)
	 * If employeeId is not set, job will be set not active for all employees (using JobPost record update in Gauzy AI)
	 * @param providerCode e.g. 'upwork'
	 * @param providerJobId Unique job id in the provider, e.g. in Upwork
	 */
	public async updateVisibility(input: IVisibilityJobPostInput): Promise<boolean> {
		return await this.gauzyAIService.updateVisibility(input);
	}

	/**
	 * Create Employee Job Application and updates Employee Job Post record that employee applied for a job
	 * @param applied This will set isApplied and appliedDate fields in Gauzy AI
	 * @param employeeId Employee who applied for a job
	 * @param providerCode e.g. 'upwork', 'linkedin', 'indeed', etc.
	 * @param providerJobId Unique job id in the provider, e.g. Job Id in Upwork
	 */
	public async updateApplied(input: IEmployeeJobApplication): Promise<IUpdateEmployeeJobPostAppliedResult> {
		return await this.gauzyAIService.updateApplied(input);
	}

	/**
	 * Apply for a job
	 * @param input
	 * @returns
	 */
	public async apply(input: IEmployeeJobApplication): Promise<IEmployeeJobApplicationAppliedResult> {
		try {
			const plainText = htmlToText(input.proposal, {
				wordwrap: false // Specify the desired line width for word wrapping
			});
			input.proposal = plainText;
		} catch (error) {
			console.log('Error while applying job', error);
		}
		return await this.gauzyAIService.apply(input);
	}

	/**
	 * Find all available Jobs matched to Gauzy Employees
	 * @param data
	 */
	public async findAll(data: IGetEmployeeJobPostInput): Promise<IPagination<IEmployeeJobPost>> {
		const employees = await this.employeeService.findAllActive();
		const { filters } = data;

		const { organizationId } = filters;
		const tenantId = RequestContext.currentTenantId();

		let jobs: IPagination<IEmployeeJobPost>;

		try {
			const { settings } = await this.integrationTenantService.getIntegrationSettings({ organizationId, tenantId });
			const { apiKey, apiSecret } = arrayToObject(settings, 'settingsName', 'settingsValue');

			if (!apiKey || !apiSecret) {
				throw new ForbiddenException('API key and secret key are required.');
			}

			this.requestConfigProvider.setConfig({ apiKey, apiSecret });
		} catch (error) {
			throw new ForbiddenException('API key and secret key are required.');
		}

		try {
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
						jobs = await this.getRandomEmployeeJobPosts(employees, data.page, data.limit);
					}
				} else {
					const jobsConverted = result.items.map((jo) => {
						if (jo.employeeId) {
							const employee = employees.find((emp) => emp.id === jo.employeeId);
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
					jobs = await this.getRandomEmployeeJobPosts(employees, data.page, data.limit);
				} else {
					jobs = {
						items: [],
						total: 0
					};
				}
			}

			return jobs;
		} catch (error) {
			return {
				items: [],
				total: 0
			}
		}
	}

	/**
	 * Call pre process method to create new employee job application record.
	 *
	 * @param params
	 * @returns
	 */
	public async preProcessEmployeeJobApplication(params: IEmployeeJobApplication) {
		return await this.gauzyAIService.preProcessEmployeeJobApplication(params);
	}

	/**
	 * Generate AI proposal for employee job application
	 *
	 * @param employeeJobApplicationId
	 */
	public async generateAIProposal(employeeJobApplicationId: string): Promise<void> {
		return await this.gauzyAIService.generateAIProposalForEmployeeJobApplication(employeeJobApplicationId);
	}

	/**
	 * Get employee job application where proposal generated by AI
	 *
	 * @param employeeJobApplicationId
	 * @returns
	 */
	public async getEmployeeJobApplication(employeeJobApplicationId: string) {
		return await this.gauzyAIService.getEmployeeJobApplication(employeeJobApplicationId);
	}

	private async getRandomEmployeeJobPosts(
		employees?: IEmployee[],
		page = 0,
		limit = 10
	): Promise<IPagination<IEmployeeJobPost>> {
		const { items: countries = [] as ICountry[] } = await this.countryService.findAll();

		const employeesJobs: EmployeeJobPost[] = [];
		for (let i = 0; i < limit; i++) {
			const employee = faker.helpers.arrayElement(employees);
			const jobPostEmployee = new EmployeeJobPost({
				employeeId: employee ? employee.id : null,
				employee: employee
			});

			const job = new JobPost({
				country: faker.helpers.arrayElement(countries).isoCode,
				category: faker.person.jobTitle(),
				title: faker.lorem.sentence(),
				description: faker.lorem.sentences(3),
				jobDateCreated: faker.date.past({ years: 0.1 }),
				jobStatus: faker.helpers.arrayElement(Object.values(JobPostStatusEnum)),
				jobSource: faker.helpers.arrayElement(Object.values(JobPostSourceEnum)),
				jobType: faker.helpers.arrayElement(Object.values(JobPostTypeEnum))
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
