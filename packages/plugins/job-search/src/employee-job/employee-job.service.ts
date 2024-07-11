import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { htmlToText } from 'html-to-text';
import { environment as env } from '@gauzy/config';
import { GauzyAIService } from '@gauzy/integration-ai';
import {
	IEmployeeJobApplication,
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
	IGetEmployeeJobPostFilters,
	IntegrationEnum,
	IntegrationEntity
} from '@gauzy/contracts';
import { EmployeeService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		private readonly _employeeService: EmployeeService,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _integrationTenantService: IntegrationTenantService
	) {}

	/**
	 * Updates job visibility
	 * @param hide Should job be hidden or visible. This will set isActive field to false in Gauzy AI
	 * @param employeeId If employeeId set, job will be set not active only for that specific employee (using EmployeeJobPost record update in Gauzy AI)
	 * If employeeId is not set, job will be set not active for all employees (using JobPost record update in Gauzy AI)
	 * @param providerCode e.g. 'upwork'
	 * @param providerJobId Unique job id in the provider, e.g. in Upwork
	 */
	public async updateVisibility(input: IVisibilityJobPostInput): Promise<boolean> {
		return await this._gauzyAIService.updateVisibility(input);
	}

	/**
	 * Create Employee Job Application and updates Employee Job Post record that employee applied for a job
	 * @param applied This will set isApplied and appliedDate fields in Gauzy AI
	 * @param employeeId Employee who applied for a job
	 * @param providerCode e.g. 'upwork', 'linkedin', 'indeed', etc.
	 * @param providerJobId Unique job id in the provider, e.g. Job Id in Upwork
	 */
	public async updateApplied(input: IEmployeeJobApplication): Promise<IUpdateEmployeeJobPostAppliedResult> {
		return await this._gauzyAIService.updateApplied(input);
	}

	/**
	 * Applies for a job by converting HTML content to plain text and then forwarding the application to a service.
	 *
	 * @param input The input data for applying to the job, including the job application proposal.
	 * @returns A promise that resolves to the result of the job application.
	 */
	public async apply(input: IEmployeeJobApplication): Promise<IEmployeeJobApplicationAppliedResult> {
		try {
			const plainText = htmlToText(input.proposal, {
				wordwrap: false // Specify the desired line width for word wrapping
			});
			input.proposal = plainText;
		} catch (error) {
			console.log('Error while applying job', error);
			// Handle the error here, you might want to throw it or return a specific error result
		}
		// Return the result of applying for the job
		return await this._gauzyAIService.apply(input);
	}

	/**
	 * Find all available Jobs matched to Gauzy Employees
	 * @param data
	 */
	public async findAll(data: IGetEmployeeJobPostInput): Promise<IPagination<IEmployeeJobPost>> {
		const employees = await this._employeeService.findAllActive();
		let jobs: IPagination<IEmployeeJobPost>;

		try {
			if (env.gauzyAIGraphQLEndpoint) {
				const filters: IGetEmployeeJobPostFilters = data.filters;

				const { organizationId } = data.filters;
				const tenantId = RequestContext.currentTenantId() || filters.tenantId;

				// Retrieve integration
				const integration = await this._integrationTenantService.getIntegrationByOptions({
					organizationId,
					tenantId,
					name: IntegrationEnum.GAUZY_AI
				});

				// Check if integration exists
				if (!!integration) {
					const integrationId = integration['id'];

					// Check if job matching entity sync is enabled
					await this._integrationTenantService.findIntegrationTenantByEntity({
						integrationId,
						organizationId,
						entityType: IntegrationEntity.JOB_MATCHING
					});

					const result = await this._gauzyAIService.getEmployeesJobPosts(data);
					if (result === null) {
						if (env.production) {
							// OK, so for some reason connection go Gauzy AI failed, we can't get jobs ...
							jobs = {
								items: [],
								total: 0
							};
						} else {
							// In development, even if connection failed, we want to show fake jobs in UI
							jobs = await this.getRandomEmployeeJobPosts(employees, data.limit);
						}
					} else {
						const jobsConverted = result.items.map((job) => {
							if (job.employeeId) {
								const employee = employees.find((employee) => employee.id === job.employeeId);
								job.employee = employee;
							}
							return job;
						});

						jobs = {
							items: jobsConverted,
							total: result.total
						};
					}
				} else {
					// If integration not enabled, we want to show fake jobs in UI
					jobs = await this.getRandomEmployeeJobPosts(employees, data.limit);
				}
			} else {
				// If it's production, we should return empty here because we don't want fake jobs in production
				if (env.production === false) {
					jobs = await this.getRandomEmployeeJobPosts(employees, data.limit);
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
			};
		}
	}

	/**
	 * Call pre process method to create new employee job application record.
	 *
	 * @param params
	 * @returns
	 */
	public async preProcessEmployeeJobApplication(params: IEmployeeJobApplication) {
		return await this._gauzyAIService.preProcessEmployeeJobApplication(params);
	}

	/**
	 * Generate AI proposal for employee job application
	 *
	 * @param employeeJobApplicationId
	 */
	public async generateAIProposal(employeeJobApplicationId: string): Promise<void> {
		return await this._gauzyAIService.generateAIProposalForEmployeeJobApplication(employeeJobApplicationId);
	}

	/**
	 * Get employee job application where proposal generated by AI
	 *
	 * @param employeeJobApplicationId
	 * @returns
	 */
	public async getEmployeeJobApplication(employeeJobApplicationId: string) {
		return await this._gauzyAIService.getEmployeeJobApplication(employeeJobApplicationId);
	}

	/**
	 * Generates random employee job posts.
	 *
	 * @param employees The array of employees to assign to job posts.
	 * @param limit The maximum number of job posts to generate.
	 * @returns A promise that resolves to an object containing paginated employee job posts.
	 */
	private async getRandomEmployeeJobPosts(
		employees: IEmployee[] = [],
		limit = 10
	): Promise<IPagination<IEmployeeJobPost>> {
		const employeesJobs: EmployeeJobPost[] = [];

		for (let i = 0; i < limit; i++) {
			const employee = faker.helpers.arrayElement(employees);
			const jobPostEmployee = new EmployeeJobPost({
				employeeId: employee ? employee.id : null,
				employee: employee
			});
			const job = new JobPost({
				country: faker.location.countryCode(),
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
