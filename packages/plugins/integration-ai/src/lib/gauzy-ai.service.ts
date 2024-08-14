import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import qs from 'qs';
import { Observable, firstValueFrom } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
	CreateEmployeeJobApplication,
	User,
	Employee,
	EmployeeJobPostsDocument,
	EmployeeJobPostsQuery,
	EmployeeQuery,
	UpdateEmployee,
	UpdateEmployeeJobPost,
	UpworkJobsSearchCriterion,
	UserConnection,
	Query,
	TenantConnection,
	UpdateTenantApiKey,
	TenantApiKeyConnection,
	Tenant,
	EmployeeJobPostFilter
} from './sdk/gauzy-ai-sdk';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
import fetch from 'cross-fetch';
import * as chalk from 'chalk';
import * as FormData from 'form-data';
import {
	ApolloClient,
	ApolloQueryResult,
	NormalizedCacheObject,
	InMemoryCache,
	DefaultOptions,
	// NetworkStatus,
	gql,
	createHttpLink,
	ApolloLink
} from '@apollo/client/core';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IEmployee,
	IVisibilityJobPostInput,
	IEmployeeJobApplication,
	IUpdateEmployeeJobPostAppliedResult,
	IEmployeeJobApplicationAppliedResult,
	IGetEmployeeJobPostInput,
	IPagination,
	IEmployeeJobPost,
	IJobPost,
	IGetEmployeeJobPostFilters,
	JobPostStatusEnum,
	JobPostTypeEnum,
	IEmployeeJobsStatistics
} from '@gauzy/contracts';
import { RequestConfigProvider } from './request-config.provider';
import { AxiosRequestHeaders, HttpMethodEnum } from './configuration.interface';

export interface ImageAnalysisResult {
	success: boolean;
	data: {
		mimetype: string;
		filename: string;
		analysis: Array<{
			work: boolean;
			description: string;
			apps: string[];
		}>;
		message?: string;
	};
}

@Injectable()
export class GauzyAIService {
	private readonly _logger = new Logger(GauzyAIService.name);
	private _client: ApolloClient<NormalizedCacheObject>;
	public logging: boolean = false;

	// For now, we disable Apollo client caching for all GraphQL queries and mutations
	private readonly defaultOptions: DefaultOptions = {
		watchQuery: {
			fetchPolicy: 'no-cache',
			errorPolicy: 'ignore'
		},
		query: {
			fetchPolicy: 'no-cache',
			errorPolicy: 'all'
		},
		mutate: {
			fetchPolicy: 'no-cache',
			errorPolicy: 'all'
		}
	};

	private gauzyAIGraphQLEndpoint: string;

	constructor(
		private readonly _configService: ConfigService,
		private readonly _http: HttpService,
		private readonly _requestConfigProvider: RequestConfigProvider
	) {
		this.init();
	}

	/**
	 * Send an HTTP request with dynamic configuration.
	 *
	 * @param path The URL path for the request.
	 * @param options Custom Axios request configuration.
	 * @param method The HTTP method (e.g., GET, POST).
	 * @returns An Observable that emits the response data or throws an error.
	 */
	private sendRequest<T>(
		path: string,
		options: AxiosRequestConfig = {},
		method: string = HttpMethodEnum.GET,
		defaultHeaders: AxiosRequestHeaders = {
			'Content-Type': 'application/json' // Define default headers
		}
	): Observable<AxiosResponse<T>> {
		/** */
		const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId, bearerTokenApi, tenantIdApi } =
			this._requestConfigProvider.getConfig();

		// Add your custom headers
		const customHeaders = (): AxiosRequestHeaders => ({
			// Define default headers
			...defaultHeaders,
			// Add your custom headers here
			'X-APP-ID': this._configService.get<string>('gauzyAI.gauzyAiApiKey'),
			'X-API-KEY': this._configService.get<string>('gauzyAI.gauzyAiApiSecret'),

			/** */
			...(apiKey ? { 'X-APP-ID': apiKey } : {}),
			...(apiSecret ? { 'X-API-KEY': apiSecret } : {}),
			...(openAiSecretKey ? { 'X-OPENAI-SECRET-KEY': openAiSecretKey } : {}),
			...(openAiOrganizationId ? { 'X-OPENAI-ORGANIZATION-ID': openAiOrganizationId } : {}),

			/** */
			...(bearerTokenApi ? { Authorization: bearerTokenApi } : {}),
			...(tenantIdApi ? { 'Tenant-Id': tenantIdApi } : {})
		});

		/** */
		const headers: AxiosRequestHeaders = customHeaders();

		if (this.logging) {
			console.log('Default AxiosRequestConfig Headers: %s', `${JSON.stringify(headers)}`);
		}

		// Merge the provided options with the default options
		const mergedOptions: AxiosRequestConfig<T> = {
			...options,
			// Inside your sendRequest method, use qs.stringify for custom parameter serialization
			paramsSerializer: (params) => {
				// console.log('Customize the serialization of URL parameters', params);
				if (Object.keys(params).length > 0) {
					// Customize the serialization of URL parameters as needed
					return qs.stringify(params, { arrayFormat: 'repeat' });
				}
			}
		};
		// console.log('Default AxiosRequestConfig Options: %s', `${JSON.stringify(mergedOptions)}`);

		try {
			return this._http.request<T>({
				...mergedOptions,
				url: path,
				method,
				headers
			});
		} catch (error) {
			console.log('Error while sending an HTTP request with dynamic configuration.: %s', error);
			if (error.response) {
				// Handle HTTP error responses
				throw new HttpException(error.response.data, error.response.status);
			} else {
				// Handle other types of errors (e.g., network issues)
				throw new HttpException(
					'An error occurred while making the request.',
					HttpStatus.INTERNAL_SERVER_ERROR
				);
			}
		}
	}

	/**
	 * Analyze an image/screenshot using Gauzy AI.
	 *
	 * @param files - Array of Buffers representing the uploaded images.
	 * @returns Promise<any> - The analysis result for the image.
	 */
	public async analyzeImage(stream: Buffer, file: any): Promise<ImageAnalysisResult[]> {
		// Create FormData and append the image data
		const form = new FormData();

		// Assuming you have an image file or buffer
		form.append(`files`, stream, {
			filename: file.filename,
			contentType: 'application/octet-stream'
		});

		// Set custom headers
		const headers = {
			...form.getHeaders(),
			'Content-Length': form.getLengthSync().toString()
			// Add any other headers you need
		};

		// Set request options
		const options = {
			data: form, // Set the request payload
			params: {}
		};

		// Call the sendRequest function with the appropriate parameters
		return await firstValueFrom(
			this.sendRequest<ImageAnalysisResult[]>('image/process', options, HttpMethodEnum.POST, headers).pipe(
				map((resp: AxiosResponse<any, any>) => resp.data)
			)
		);
	}

	/**
	 * Call pre process method to create new employee job application record.
	 *
	 * @param params
	 * @returns
	 */
	public async preProcessEmployeeJobApplication(params: IEmployeeJobApplication): Promise<any> {
		// First we need to get employee id because we have only externalId
		params.employeeId = await this.getEmployeeGauzyAIId(params.employeeId);

		// Call the sendRequest function with the appropriate parameters
		return await firstValueFrom(
			this.sendRequest<any>(
				'employee/job/application/pre-process',
				{
					data: params // Set the request payload
				},
				HttpMethodEnum.POST
			).pipe(
				tap((resp: AxiosResponse<any, any>) => console.log(resp)),
				map((resp: AxiosResponse<any, any>) => resp.data)
			)
		);
	}

	/**
	 * Generate AI proposal for employee job application
	 *
	 * @param employeeJobApplicationId
	 * @returns
	 */
	public async generateAIProposalForEmployeeJobApplication(employeeJobApplicationId: string): Promise<void> {
		// Call the sendRequest function with the appropriate parameters
		return await firstValueFrom(
			this.sendRequest<any>(
				`employee/job/application/generate-proposal/${employeeJobApplicationId}`,
				{},
				HttpMethodEnum.POST
			).pipe(
				tap((resp: AxiosResponse<any, any>) => console.log(resp)),
				map((resp: AxiosResponse<any, any>) => resp.data)
			)
		);
	}

	/**
	 * Get employee job application where proposal generated by AI
	 *
	 * @param employeeJobApplicationId
	 * @returns
	 */
	public async getEmployeeJobApplication(employeeJobApplicationId: string): Promise<void> {
		// Call the sendRequest function with the appropriate parameters
		return await firstValueFrom(
			this.sendRequest<any>(`employee/job/application/${employeeJobApplicationId}`).pipe(
				tap((resp: AxiosResponse<any, any>) => console.log(resp)),
				map((resp: AxiosResponse<any, any>) => resp.data)
			)
		);
	}

	/**
	 * Get statistic from Gauzy AI about how many jobs are available for given employee
	 * and to how many of jobs employee already applied and more statistic in the future.
	 */
	public async getEmployeesStatistics(): Promise<IEmployeeJobsStatistics[]> {
		return [];
	}

	/**
	 * Updates in Gauzy AI if given Employee looking for a jobs or not.
	 * If not looking, Gauzy AI will NOT return jobs for such employee and will NOT crawl sources for jobs for such employee
	 * @param employeeId
	 * @param isJobSearchActive
	 */
	public async updateEmployeeStatus({
		employeeId,
		tenantId,
		organizationId,
		isJobSearchActive
	}: {
		employeeId: string;
		userId: string;
		tenantId: string;
		organizationId: string;
		isJobSearchActive: boolean;
	}): Promise<boolean> {
		if (this._client == null) {
			return false;
		}

		// First we need to get employee id because we have only externalId
		const gauzyAIEmployeeId = await this.getEmployeeGauzyAIId(employeeId);

		console.log(
			`updateEmployeeStatus called. EmployeeId: ${employeeId}. Gauzy AI EmployeeId: ${gauzyAIEmployeeId}`
		);

		const update: UpdateEmployee = {
			externalEmployeeId: employeeId,
			externalTenantId: tenantId,
			externalOrgId: organizationId,
			isActive: isJobSearchActive,
			isArchived: !isJobSearchActive
		};

		const updateEmployeeMutation: DocumentNode<any> = gql`
			mutation updateOneEmployee($input: UpdateOneEmployeeInput!) {
				updateOneEmployee(input: $input) {
					externalEmployeeId
					externalTenantId
					externalOrgId
					isActive
					isArchived
				}
			}
		`;

		await this._client.mutate({
			mutation: updateEmployeeMutation,
			variables: {
				input: {
					id: gauzyAIEmployeeId,
					update: update
				}
			}
		});

		return true;
	}

	/**
	 * Apply for a Job
	 * @param input
	 * @returns
	 */
	public async apply(input: IEmployeeJobApplication): Promise<IEmployeeJobApplicationAppliedResult> {
		if (this._client == null) {
			return {
				...input,
				isRedirectRequired: true
			};
		}

		// First we need to get employee id because we have only externalId
		const employeeId = await this.getEmployeeGauzyAIId(input.employeeId);
		console.log(chalk.green(`Method 'apply' is called. EmployeeId: ${employeeId}`));

		// Next we need to get a job using providerCode and providerJobId
		const jobPostId = await this.getJobPostId(input.providerCode, input.providerJobId);
		console.log(chalk.green(`Method 'apply' is called. jobPostId: ${jobPostId}`));

		// Next, we need to find `public employee job post` table record in Gauzy AI to get id of record.
		// We can find by employeeId and jobPostId

		const employeeJobPostId = await this.getEmployeeJobPostId(employeeId, jobPostId);
		console.log(chalk.green(`Method 'apply' is called. employeeJobPostId: ${employeeJobPostId}`));

		if (employeeId && jobPostId && employeeJobPostId) {
			const applicationDate = new Date();

			// ------------------ Create Employee Job Application ------------------
			// This will Apply to the job using Automation system

			const createOneEmployeeJobApplication: CreateEmployeeJobApplication = {
				employeeId: employeeId,
				jobPostId: jobPostId,
				proposal: input.proposal,
				rate: input.rate,
				// details: input.details,
				attachments: input.attachments,
				appliedDate: applicationDate,
				employeeJobPostId: employeeJobPostId,
				isActive: true,
				isArchived: false,
				providerCode: input.providerCode,
				providerJobId: input.providerJobId,
				jobType: input.jobType,
				jobStatus: input.jobStatus,
				terms: input.terms,
				qa: input.qa
				// Note: isViewedByClient will be updated by our Automation system
				// Note: providerJobApplicationId will be set by Automation system when it's applied to the job
			};

			// Call the sendRequest function with the appropriate parameters
			const response = await firstValueFrom(
				this.sendRequest<any>(`employee/job/application/process`, {
					method: HttpMethodEnum.POST, // Set the HTTP method to GET
					data: createOneEmployeeJobApplication
				}).pipe(map((resp: AxiosResponse<any, any>) => resp.data))
			);

			return {
				...response,
				isRedirectRequired: false
			};
		} else {
			return { ...input, isRedirectRequired: true };
		}
	}

	/**
	 * Updates job visibility
	 * @param hide Should job be hidden or visible. This will set isActive field to false in Gauzy AI
	 * @param employeeId If employeeId set, job will be set not active only for that specific employee (using EmployeeJobPost record update in Gauzy AI)
	 * If employeeId is not set, job will be set not active for all employees (using JobPost record update in Gauzy AI)
	 * @param providerCode e.g. 'upwork'
	 * @param providerJobId Unique job id in the provider, e.g. in Upwork. If this value is not set, it will update ALL jobs for given provider
	 */
	public async updateVisibility(input: IVisibilityJobPostInput): Promise<boolean> {
		if (this._client == null) {
			return false;
		}

		// If it's for specific employee and specific job
		if (input.employeeId && input.providerCode && input.providerJobId) {
			// First we need to get employee id because we have only externalId
			const employeeId = await this.getEmployeeGauzyAIId(input.employeeId);

			console.log(`updateVisibility called. EmployeeId: ${employeeId}`);

			// Next we need to get a job using providerCode and providerJobId
			const jobPostId = await this.getJobPostId(input.providerCode, input.providerJobId);

			console.log(`updateVisibility called. jobPostId: ${jobPostId}`);

			// Next, we need to find `public employee job post` table record in Gauzy AI to get id of record.
			// We can find by employeeId and jobPostId

			const employeeJobPostId = await this.getEmployeeJobPostId(employeeId, jobPostId);

			console.log(`updateVisibility called. employeeJobPostId: ${employeeJobPostId}`);

			if (employeeId && jobPostId && employeeJobPostId) {
				const update: UpdateEmployeeJobPost = {
					employeeId: employeeId,
					jobPostId: jobPostId,
					isActive: !input.hide,
					isArchived: input.hide
				};

				const updateEmployeeJobPostMutation: DocumentNode<any> = gql`
					mutation updateOneEmployeeJobPost($input: UpdateOneEmployeeJobPostInput!) {
						updateOneEmployeeJobPost(input: $input) {
							employeeId
							jobPostId
							isActive
							isArchived
							isApplied
							appliedDate
						}
					}
				`;

				await this._client.mutate({
					mutation: updateEmployeeJobPostMutation,
					variables: {
						input: {
							id: employeeJobPostId,
							update: update
						}
					}
				});

				return true;
			}
		} else {
			// OK, so it's for all jobs for all employees or for all jobs on specific employee
			// TODO: implement
		}

		return false;
	}

	/**
	 * Create Employee Job Application and updates Employee Job Post record that employee applied for a job
	 * NOTE: We will not use this method for now.
	 *
	 * Inside interface IEmployeeJobApplication we get below fields
	 *	applied: boolean; <- This will set isApplied and appliedDate fields in Gauzy AI
	 *	employeeId: string; <- Employee who applied for a job
	 *	providerCode: string; <- e.g. 'upwork'
	 *	providerJobId: string; <- Unique job id in the provider, e.g. in Upwork
	 * 	proposal?: string; <- Proposal text (optional)
	 * 	rate?: number; <- Rate (optional, number)
	 *	details?: string; <- Details (optional)
	 * 	attachments?: string; <- Attachments (optional, comma separated list of file names)
	 */
	public async updateApplied(input: IEmployeeJobApplication): Promise<IUpdateEmployeeJobPostAppliedResult> {
		if (this._client == null) {
			return { isRedirectRequired: true };
		}

		// First we need to get employee id because we have only externalId
		const employeeId = await this.getEmployeeGauzyAIId(input.employeeId);
		console.log(chalk.green(`updateApplied called. EmployeeId: ${employeeId}`));

		// Next we need to get a job using providerCode and providerJobId
		const jobPostId = await this.getJobPostId(input.providerCode, input.providerJobId);
		console.log(chalk.green(`updateApplied called. jobPostId: ${jobPostId}`));

		// Next, we need to find `public employee job post` table record in Gauzy AI to get id of record.
		// We can find by employeeId and jobPostId

		const employeeJobPostId = await this.getEmployeeJobPostId(employeeId, jobPostId);
		console.log(chalk.green(`updateApplied called. employeeJobPostId: ${employeeJobPostId}`));

		if (employeeId && jobPostId && employeeJobPostId) {
			const applicationDate = new Date();

			// ------------------ Create Employee Job Application ------------------
			// This will Apply to the job using Automation system

			const createOneEmployeeJobApplication: CreateEmployeeJobApplication = {
				employeeId: employeeId,
				jobPostId: jobPostId,
				proposal: input.proposal,
				rate: input.rate,
				// details: input.details,
				attachments: input.attachments,
				appliedDate: applicationDate,
				employeeJobPostId: employeeJobPostId,
				isActive: true,
				isArchived: false,
				providerCode: input.providerCode,
				providerJobId: input.providerJobId,
				jobType: input.jobType,
				jobStatus: input.jobStatus,
				terms: input.terms,
				qa: input.qa
				// Note: isViewedByClient will be updated by our Automation system
				// Note: providerJobApplicationId will be set by Automation system when it's applied to the job
			};

			const createOneEmployeeJobApplicationMutation: DocumentNode<any> = gql`
				mutation createOneEmployeeJobApplication($input: CreateOneEmployeeJobApplicationInput!) {
					createOneEmployeeJobApplication(input: $input) {
						employeeId
						jobPostId
						proposal
						rate
						attachments
						appliedDate
						employeeJobPostId
						isActive
						isArchived
						providerCode
						providerJobId
						jobType
						jobStatus
						terms
						qa
					}
				}
			`;

			await this._client.mutate({
				mutation: createOneEmployeeJobApplicationMutation,
				variables: {
					input: {
						employeeJobApplication: createOneEmployeeJobApplication
					}
				}
			});

			// ------------------ Update Employee Job Post Record ------------------
			// Note: it's just set isApplied and appliedDate fields in Gauzy AI

			const update: UpdateEmployeeJobPost = {
				employeeId: employeeId,
				jobPostId: jobPostId,
				isApplied: input.applied || true,
				appliedDate: applicationDate
			};

			const updateEmployeeJobPostMutation: DocumentNode<any> = gql`
				mutation updateOneEmployeeJobPost($input: UpdateOneEmployeeJobPostInput!) {
					updateOneEmployeeJobPost(input: $input) {
						employeeId
						jobPostId
						isActive
						isArchived
						isApplied
						appliedDate
					}
				}
			`;

			await this._client.mutate({
				mutation: updateEmployeeJobPostMutation,
				variables: {
					input: {
						id: employeeJobPostId,
						update: update
					}
				}
			});
		}

		// TODO: here we need to check what returned from Gauzy AI
		// Because for some providers (e.g. Upwork), redirect to apply manually required
		// But for other providers, apply can work inside Gauzy AI automatically
		return { isRedirectRequired: true };
	}

	// We call this on each "Save" operation for matching for employee.
	// Both when Preset saved for given employee and when any criteria saved for given employee (new criteria or changes in criteria)
	// You should pass `employee` entity for which anything on Matching page was changes
	// IMPORTANT: You should ALWAYS pass ALL criteria defined for given employee on Matching page, not only new or changed!
	// Best way to call this method, is to reload from Gauzy DB all criteria for given employee before call this method.
	// We DO NOT USE DATA YOU PASS FROM UI!
	// INSTEAD, We CALL THIS METHOD FROM YOUR CQRS COMMAND HANDLERS when you detect that anything related to matching changes
	// But as explained above, we must reload criteria from DB, not use anything you have in the local variables
	// (because it might not be full data, but this method requires all data to be synced to Gauzy AI, even if such data was previously already synced)
	// How this method will work internally:
	// - it will call sync for employee first and if no such employee exists in Gauzy AI, it will create new. If exists, it will update employee properties, e.g. lastName
	// - next, it will remove all criteria for employee in Gauzy AI and create new records again for criterions.
	// I.e. no update will be done, it will be full replacement
	// The reason it's acceptable is because such data changes rarely for given employee, so it's totally fine to recreate it
	// NOTE: will need to call this method from multiple different CQRS command handlers!
	public async syncGauzyEmployeeJobSearchCriteria(
		employee: IEmployee,
		criteria: IEmployeeUpworkJobsSearchCriterion[]
	): Promise<boolean> {
		if (this._client == null) {
			return false;
		}

		console.log(
			`syncGauzyEmployeeJobSearchCriteria called. Criteria: ${JSON.stringify(
				criteria
			)}. Employee: ${JSON.stringify(employee)}`
		);

		try {
			const gauzyAIUser: User = await this.syncUser({
				firstName: employee.user.firstName,
				lastName: employee.user.lastName,
				email: employee.user.email,
				username: employee.user.username,
				hash: employee.user.hash,
				externalTenantId: employee.user.tenantId,
				externalUserId: employee.user.id,
				isActive: employee.isActive,
				isArchived: false
			});
			console.log(`Synced User ${JSON.stringify(gauzyAIUser)}`);
			/** */
			const gauzyAIEmployee: Employee = await this.syncEmployee({
				externalEmployeeId: employee.id,
				externalTenantId: employee.tenantId,
				externalOrgId: employee.organizationId,
				upworkOrganizationId: employee.organization.upworkOrganizationId,
				upworkOrganizationName: employee.organization.upworkOrganizationName,
				upworkId: employee.upworkId,
				linkedInId: employee.linkedInId,
				isActive: employee.isActive,
				isArchived: false,
				firstName: employee.user.firstName,
				lastName: employee.user.lastName,
				userId: gauzyAIUser.id
			});
			console.log(`Synced Employee ${JSON.stringify(gauzyAIEmployee)}`);

			// let's delete all criteria for Employee

			const deleteAllCriteriaMutation: DocumentNode<any> = gql`
				mutation deleteManyUpworkJobsSearchCriteria($input: DeleteManyUpworkJobsSearchCriteriaInput!) {
					deleteManyUpworkJobsSearchCriteria(input: $input) {
						deletedCount
					}
				}
			`;

			const deleteMutationResult = await this._client.mutate({
				mutation: deleteAllCriteriaMutation,
				variables: {
					input: {
						filter: {
							isActive: {
								is: true
							},
							isArchived: {
								is: false
							},
							employeeId: {
								eq: gauzyAIEmployee.id
							}
						}
					}
				}
			});

			console.log(
				`Delete Existed Criterions count: ${JSON.stringify(
					deleteMutationResult.data.deleteManyUpworkJobsSearchCriteria.deletedCount
				)}`
			);

			// now let's create new criteria in Gauzy AI based on Gauzy criterions data

			if (criteria && criteria.length > 0) {
				const gauzyAICriteria: UpworkJobsSearchCriterion[] = [];

				criteria.forEach((criterion: IEmployeeUpworkJobsSearchCriterion) => {
					gauzyAICriteria.push({
						employeeId: gauzyAIEmployee.id,
						isActive: true,
						isArchived: false,
						jobType: criterion.jobType,
						keyword: criterion.keyword,
						...(criterion.category?.name ? { category: criterion.category?.name } : {}),
						...(criterion.categoryId ? { categoryId: criterion.categoryId } : {}),
						...(criterion.occupation?.name ? { occupation: criterion.occupation?.name } : {}),
						...(criterion.occupationId ? { occupationId: criterion.occupationId } : {})
					});
				});

				const createManyUpworkJobsSearchCriteriaMutation: DocumentNode<any> = gql`
					mutation CreateManyUpworkJobsSearchCriteria($input: CreateManyUpworkJobsSearchCriteriaInput!) {
						createManyUpworkJobsSearchCriteria(input: $input) {
							id
						}
					}
				`;

				const createNewCriteriaResult = await this._client.mutate({
					mutation: createManyUpworkJobsSearchCriteriaMutation,
					variables: {
						input: {
							upworkJobsSearchCriteria: gauzyAICriteria
						}
					}
				});

				console.log(
					`Create New Criteria result: ${JSON.stringify(
						createNewCriteriaResult.data.createManyUpworkJobsSearchCriteria
					)}`
				);
			}

			return true;
		} catch (error) {
			console.log('Error while synced employee: %s', error?.message);
			this._logger.error(error);
			return false;
		}
	}

	/**
	 * Creates employees in Gauzy AI if not exists yet. If exists, updates fields, including externalEmployeeId
	 * How it works:
	 * - search done externalEmployeeId field first in Gauzy AI to be equal to Gauzy employee Id.
	 * - if no record found in Gauzy AI, it search Gauzy AI employees records by employee name
	 * - if no record found in Gauzy AI, it creates new employee in Gauzy AI
	 *
	 * @param employees
	 */
	public async syncEmployees(employees: IEmployee[]): Promise<boolean> {
		if (this._client == null) {
			return false;
		}
		try {
			await Promise.all(
				employees.map(async (employee) => {
					try {
						try {
							/** */
							const gauzyAIUser: User = await this.syncUser({
								firstName: employee.user.firstName,
								lastName: employee.user.lastName,
								email: employee.user.email,
								username: employee.user.username,
								hash: employee.user.hash,
								externalTenantId: employee.user.tenantId,
								externalUserId: employee.user.id,
								isActive: employee.isActive,
								isArchived: !employee.isActive
							});
							console.log(`Synced User ${JSON.stringify(gauzyAIUser)}`);

							try {
								/**  */
								const gauzyAIEmployee: Employee = await this.syncEmployee({
									externalEmployeeId: employee.id,
									externalTenantId: employee.tenantId,
									externalOrgId: employee.organizationId,
									upworkOrganizationId: employee.organization.upworkOrganizationId,
									upworkOrganizationName: employee.organization.upworkOrganizationName,
									upworkId: employee.upworkId,
									linkedInId: employee.linkedInId,
									isActive: employee.isActive,
									isArchived: !employee.isActive,
									firstName: employee.user.firstName,
									lastName: employee.user.lastName,
									userId: gauzyAIUser.id
								});
								console.log(`Synced Employee ${JSON.stringify(gauzyAIEmployee)}`);
							} catch (error) {
								console.log('Error while syncing employee: %s', error?.message);
								this._logger.error(error);

								// Use this (using the "options" parameter):
								throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
							}
						} catch (error) {
							console.log('Error while syncing user: %s', error?.message);
							this._logger.error(error);

							// Use this (using the "options" parameter):
							throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
						}
					} catch (error) {
						// Handle errors for each employee if necessary
						console.error(`Error processing sync employee: ${employee.id}`, error?.message);
						this._logger.error(error);

						// Use this (using the "options" parameter):
						throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
					}
				})
			);
			return true;
		} catch (error) {
			console.log('Error while syncing employees: %s', error?.message);
			return false;
		}
	}

	/**
	 * Get Jobs available for registered employees
	 */
	public async getEmployeesJobPosts(data: IGetEmployeeJobPostInput): Promise<IPagination<IEmployeeJobPost>> {
		if (this._client == null) {
			return null;
		}

		const filters: IGetEmployeeJobPostFilters = data.filters ?? undefined;
		console.log(`getEmployeesJobPosts. Filters ${JSON.stringify(filters)}`);

		const employeeIdFilter = filters?.employeeIds?.[0] ?? undefined; // Employee ID filter
		const tenantIdFilter = filters?.tenantId ?? undefined; // Tenant ID filter

		try {
			// TODO: use Query saved in SDK, not hard-code it here. Note: we may add much more fields to that query as we need more info!
			const employeesQuery: DocumentNode<EmployeeJobPostsQuery> = gql`
				query employeeJobPosts(
					$after: ConnectionCursor!
					$first: Int!
					$filter: EmployeeJobPostFilter!
					$sorting: [EmployeeJobPostSort!]
				) {
					employeeJobPosts(paging: { after: $after, first: $first }, filter: $filter, sorting: $sorting) {
						totalCount
						pageInfo {
							hasNextPage
							hasPreviousPage
							startCursor
							endCursor
						}
						edges {
							node {
								id
								isApplied
								appliedDate
								createdAt
								updatedAt
								isActive
								isArchived
								employee {
									id
									externalEmployeeId
								}
								providerCode
								providerJobId
								jobDateCreated
								jobStatus
								jobType
								jobPost {
									id
									providerCode
									providerJobId
									title
									description
									jobDateCreated
									jobStatus
									jobType
									url
									budget
									duration
									workload
									skills
									category
									subcategory
									country
									clientFeedback
									clientReviewsCount
									clientJobsPosted
									clientPastHires
									clientPaymentVerificationStatus
									searchCategory
									searchOccupation
									searchKeyword
								}
							}
						}
					}
				}
			`;

			const jobResponses: IEmployeeJobPost[] = [];

			let isContinue: boolean;
			let after = '';

			const filter: EmployeeJobPostFilter = {
				isActive: {
					is: true
				},
				isArchived: {
					is: false
				},
				...(filters && filters.isApplied
					? {
							isApplied: {
								is: JSON.parse(filters.isApplied)
							}
					  }
					: {}),
				...(filters && filters.jobDateCreated
					? {
							jobDateCreated: filters.jobDateCreated
					  }
					: {}),
				...(filters && filters.title
					? {
							jobPost: {
								title: {
									iLike: `%${filters.title}%`
								}
							}
					  }
					: {}),
				...(filters && filters.jobType
					? {
							jobType: {
								in: filters.jobType
							}
					  }
					: {}),
				...(filters && filters.jobStatus
					? {
							jobStatus: {
								in: filters.jobStatus
							}
					  }
					: {}),
				...(filters && filters.jobSource
					? {
							providerCode: {
								in: filters.jobSource
							}
					  }
					: {})
			};

			// Get tenant by externalTenantId
			const tenant = await this.getTenantByExternalTenantId(tenantIdFilter);

			// If tenantIdFilter is provided, filter for tenantId
			if (tenant) {
				filter.tenantId = {
					eq: tenant?.id ?? undefined
				};
			} else {
				// If no tenantIdFilter is provided, filter for null tenantId
				filter.tenantId = {
					is: null
				};
			}

			// Employee ID filter
			if (employeeIdFilter) {
				// Get employee by externalEmployeeId
				const employeeId = await this.getEmployeeGauzyAIId(employeeIdFilter);

				// Employee ID filter
				filter.employeeId = {
					eq: employeeId
				};
			}

			console.log(`Applying filter: ${JSON.stringify(filter)}`);

			const graphQLPageSize = 50;

			// e.g. if it's page 7 and limit is 10, it mean we need to load first 70 records, i.e. do 2 trips to server because each trip get 50 records
			const loadCounts = Math.ceil((data.page * data.limit) / graphQLPageSize);

			console.log(`Round trips to Gauzy API: ${loadCounts}`);

			let currentCount = 1;

			let totalCount: number;

			do {
				const result: ApolloQueryResult<EmployeeJobPostsQuery> =
					await this._client.query<EmployeeJobPostsQuery>({
						query: employeesQuery,
						variables: {
							after: after,
							first: graphQLPageSize,
							sorting: [
								{
									field: 'jobDateCreated',
									direction: 'DESC'
								}
							],
							filter: filter
						}
					});

				console.log(result.errors);
				console.log(result.data);

				const jobsResponse = result.data.employeeJobPosts.edges.map((it) => {
					const rec = it.node;

					const res: IEmployeeJobPost = {
						/** Employee Job Post Matching ID */
						id: rec.id,

						employeeId: rec.employee.externalEmployeeId,
						employee: undefined,
						jobPostId: rec.jobPost.id,
						jobPost: <IJobPost>rec.jobPost,

						jobDateCreated: rec.jobDateCreated,
						providerCode: rec.providerCode,
						providerJobId: rec.providerJobId,
						jobStatus: rec.jobStatus ? JobPostStatusEnum[rec.jobStatus] : undefined,
						jobType: rec.jobType ? JobPostTypeEnum[rec.jobType] : undefined,

						isApplied: rec.isApplied,
						appliedDate: rec.appliedDate,
						isActive: rec.isActive,
						isArchived: rec.isArchived,
						createdAt: rec.createdAt,
						updatedAt: rec.updatedAt
					};

					return res;
				});

				isContinue = result.data.employeeJobPosts.pageInfo.hasNextPage && currentCount < loadCounts;
				after = result.data.employeeJobPosts.pageInfo.endCursor;
				totalCount = result.data.employeeJobPosts.totalCount;

				jobResponses.push(...jobsResponse);

				console.log(`Found ${jobsResponse.length} job records. IsContinue: ${isContinue}. After: ${after}`);

				currentCount++;
			} while (isContinue);

			// Note: possible to do additional client side filtering like below:
			// jobResponses = _.filter(jobResponses, (it) => it.isActive === true && it.isArchived === false);

			console.log(`getEmployeesJobPosts. Total Count: ${totalCount}. Page ${data.page}`);

			const response: IPagination<IEmployeeJobPost> = {
				items: this.paginate(jobResponses, data.limit, data.page),
				total: totalCount
			};

			return response;
		} catch (error) {
			console.log('Error while getting employee job posts: %s', error?.message);
			// this._logger.error(error);
			return null;
		}
	}

	private paginate(array, page_size, page_number) {
		// human-readable page numbers usually start with 1, so we reduce 1 in the first argument
		return array.slice((page_number - 1) * page_size, page_number * page_size);
	}

	private async getEmployeeJobPostId(employeeId: string, jobPostId: string): Promise<string> {
		const employeeJobPostsQuery = gql`
			query employeeJobPostsByEmployeeIdJobPostId($employeeIdFilter: String!, $jobPostIdFilter: String!) {
				employeeJobPosts(
					filter: { employeeId: { eq: $employeeIdFilter }, jobPostId: { eq: $jobPostIdFilter } }
				) {
					edges {
						node {
							id
							isActive
							isArchived
						}
					}
				}
			}
		`;

		const employeeJobPostsQueryResult = await this._client.query<any>({
			query: employeeJobPostsQuery,
			variables: {
				employeeIdFilter: employeeId,
				jobPostIdFilter: jobPostId
			}
		});

		const employeeJobPostsResponse = employeeJobPostsQueryResult.data.employeeJobPosts.edges;

		if (employeeJobPostsResponse && employeeJobPostsResponse.length > 0) {
			return employeeJobPostsResponse[0].node.id;
		}

		return null;
	}

	private async getJobPostId(providerCode: string, providerJobId: string): Promise<string> {
		const jobPostsQuery = gql`
			query jobPosts($providerCodeFilter: String!, $providerJobIdFilter: String!) {
				jobPosts(
					filter: { providerCode: { eq: $providerCodeFilter }, providerJobId: { eq: $providerJobIdFilter } }
				) {
					edges {
						node {
							id
							isActive
							isArchived
						}
					}
				}
			}
		`;

		const jobPostsQueryResult = await this._client.query<any>({
			query: jobPostsQuery,
			variables: {
				providerCodeFilter: providerCode,
				providerJobIdFilter: providerJobId
			}
		});

		const jobPostsResponse = jobPostsQueryResult.data.jobPosts.edges;

		if (jobPostsResponse && jobPostsResponse.length > 0) {
			return jobPostsResponse[0].node.id;
		}

		return null;
	}

	private async getEmployeeGauzyAIId(externalEmployeeId: string): Promise<string> {
		const employeesQuery: DocumentNode<EmployeeQuery> = gql`
			query employeeByExternalEmployeeId($externalEmployeeIdFilter: String!) {
				employees(filter: { externalEmployeeId: { eq: $externalEmployeeIdFilter } }) {
					edges {
						node {
							id
							externalEmployeeId
						}
					}
					totalCount
				}
			}
		`;

		const employeesQueryResult: ApolloQueryResult<EmployeeQuery> = await this._client.query<EmployeeQuery>({
			query: employeesQuery,
			variables: {
				externalEmployeeIdFilter: externalEmployeeId
			}
		});

		const employeesResponse = employeesQueryResult.data.employees.edges;

		if (employeesResponse.length > 0) {
			return employeesResponse[0].node.id;
		}

		return null;
	}

	private initClient() {
		// Create a custom ApolloLink to modify headers
		const authLink = new ApolloLink((operation, forward) => {
			const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId, bearerTokenApi, tenantIdApi } =
				this._requestConfigProvider.getConfig();

			// Add your custom headers here
			const customHeaders = {
				'Content-Type': 'application/json',
				// Set your initial headers here
				'X-APP-ID': this._configService.get<string>('gauzyAI.gauzyAiApiKey'),
				'X-API-KEY': this._configService.get<string>('gauzyAI.gauzyAiApiSecret'),

				...(apiKey ? { 'X-APP-ID': apiKey } : {}),
				...(apiSecret ? { 'X-API-KEY': apiSecret } : {}),
				...(openAiSecretKey ? { 'X-OPENAI-SECRET-KEY': openAiSecretKey } : {}),
				...(openAiOrganizationId ? { 'X-OPENAI-ORGANIZATION-ID': openAiOrganizationId } : {}),

				...(bearerTokenApi ? { Authorization: bearerTokenApi } : {}),
				...(tenantIdApi ? { 'Tenant-Id': tenantIdApi } : {})
			};

			if (this.logging) {
				console.log(this._requestConfigProvider.getConfig(), 'Runtime Gauzy AI Integration Config');
				console.log('Custom Run Time Headers: %s', customHeaders);
			}

			// Modify the operation context to include the headers
			operation.setContext(({ headers }) => ({
				headers: {
					...headers,
					...customHeaders
				}
			}));
			// Call the next link in the chain
			return forward(operation);
		});

		/** */
		const httpLink = createHttpLink({
			uri: this.gauzyAIGraphQLEndpoint,
			fetch
		});

		this._client = new ApolloClient({
			typeDefs: EmployeeJobPostsDocument,
			link: authLink.concat(httpLink),
			cache: new InMemoryCache(),
			defaultOptions: this.defaultOptions
		});
	}

	private init() {
		try {
			const gauzyAIRESTEndpoint = this._configService.get<string>('gauzyAI.gauzyAIRESTEndpoint');

			console.log(chalk.magenta(`GauzyAI REST Endpoint: ${gauzyAIRESTEndpoint}`));

			this.gauzyAIGraphQLEndpoint = this._configService.get<string>('gauzyAI.gauzyAIGraphQLEndpoint');

			console.log(chalk.magenta(`GauzyAI GraphQL Endpoint: ${this.gauzyAIGraphQLEndpoint}`));

			if (this.gauzyAIGraphQLEndpoint && gauzyAIRESTEndpoint) {
				this._logger.log('Gauzy AI Endpoints (GraphQL & REST) are configured in the environment');

				this.initClient();

				// const testConnectionQuery = async () => {
				// 	try {
				// 		const employeesQuery: DocumentNode<EmployeeQuery> = gql`
				// 			query employee {
				// 				employees {
				// 					edges {
				// 						node {
				// 							id
				// 						}
				// 					}
				// 					totalCount
				// 				}
				// 			}
				// 		`;

				// 		const employeesQueryResult: ApolloQueryResult<EmployeeQuery> =
				// 			await this._client.query<EmployeeQuery>({
				// 				query: employeesQuery,
				// 			});

				// 		if (
				// 			employeesQueryResult.networkStatus ===
				// 			NetworkStatus.error
				// 		) {
				// 			this._client = null;
				// 		}
				// 	} catch (err) {
				// 		this._logger.error(err);
				// 		this._client = null;
				// 	}
				// };

				// testConnectionQuery();
			} else {
				this._logger.warn('Gauzy AI Endpoints are not configured in the environment');
				this._client = null;
			}
		} catch (err) {
			this._logger.warn('Gauzy AI Endpoints are not configured in the environment');
			this._logger.error(err);
			this._client = null;
		}
	}

	/** Sync Employee between Gauzy and Gauzy AI
	 *  Creates new Employee in Gauzy AI if it's not yet exists there yet (it try to find by externalEmployeeId field value or by name)
	 *  Update existed Gauzy AI Employee record with new data from Gauzy DB
	 */
	private async syncEmployee(employee: Employee): Promise<Employee> {
		console.log('-------------------------- Sync Employee --------------------------', employee);
		try {
			// First, let's search by employee.externalEmployeeId (which is Gauzy employeeId)
			let employeesQuery: DocumentNode<EmployeeQuery> = gql`
				query employeeByExternalEmployeeId($externalEmployeeIdFilter: String!) {
					employees(filter: { externalEmployeeId: { eq: $externalEmployeeIdFilter } }) {
						edges {
							node {
								id
								externalEmployeeId
							}
						}
						totalCount
					}
				}
			`;

			let employeesQueryResult: ApolloQueryResult<EmployeeQuery> = await this._client.query<EmployeeQuery>({
				query: employeesQuery,
				variables: {
					externalEmployeeIdFilter: employee.externalEmployeeId
				}
			});

			let employeesResponse = employeesQueryResult.data.employees.edges;

			let isAlreadyCreated = employeesResponse.length > 0;

			console.log(
				`Is Employee ${employee.externalEmployeeId} already exists in Gauzy AI: ${isAlreadyCreated} by externalEmployeeId field`
			);

			if (!isAlreadyCreated) {
				// OK, so we can't find by employee.externalEmployeeId value, let's try to search by name

				employeesQuery = gql`
					query employeeByName($firstNameFilter: String!, $lastNameFilter: String!) {
						employees(filter: { firstName: { eq: $firstNameFilter }, lastName: { eq: $lastNameFilter } }) {
							edges {
								node {
									id
									firstName
									lastName
									externalEmployeeId
								}
							}
							totalCount
						}
					}
				`;

				employeesQueryResult = await this._client.query<EmployeeQuery>({
					query: employeesQuery,
					variables: {
						firstNameFilter: employee.firstName,
						lastNameFilter: employee.lastName
					}
				});

				employeesResponse = employeesQueryResult.data.employees.edges;

				isAlreadyCreated = employeesResponse.length > 0;

				console.log(
					`Is Employee ${employee.externalEmployeeId} already exists in Gauzy AI: ${isAlreadyCreated} by name fields`
				);

				if (!isAlreadyCreated) {
					const createEmployeeMutation: DocumentNode<any> = gql`
						mutation createOneEmployee($input: CreateOneEmployeeInput!) {
							createOneEmployee(input: $input) {
								id
								externalEmployeeId
								externalTenantId
								externalOrgId
								upworkOrganizationId
								upworkOrganizationName
								upworkId
								linkedInId
								firstName
								lastName
								userId
							}
						}
					`;
					try {
						const newEmployee = await this._client.mutate({
							mutation: createEmployeeMutation,
							variables: {
								input: {
									employee
								}
							}
						});
						return <Employee>newEmployee.data.createOneEmployee;
					} catch (error) {
						console.log('Error while creating employee: %s', error?.message);
					}
				}
			}

			// update record of employee
			const id = employeesResponse[0].node.id;

			const updateEmployeeMutation: DocumentNode<any> = gql`
				mutation updateOneEmployee($input: UpdateOneEmployeeInput!) {
					updateOneEmployee(input: $input) {
						externalEmployeeId
						externalTenantId
						externalOrgId
						upworkOrganizationId
						upworkOrganizationName
						upworkId
						linkedInId
						isActive
						isArchived
						firstName
						lastName
						userId
					}
				}
			`;

			await this._client.mutate({
				mutation: updateEmployeeMutation,
				variables: {
					input: {
						id: id,
						update: employee
					}
				}
			});

			return <Employee>employeesResponse[0].node;
		} catch (error) {
			console.log('Error while synced employee / user: %s', error?.message);
			throw new BadRequestException(error?.message);
		}
	}

	/**
	 * Sync User between Gauzy and Gauzy AI
	 * Creates new User in Gauzy AI if it's not yet exists there yet (it try to find by externalUserId field value or by email)
	 * Update existed Gauzy AI User record with new data from Gauzy DB
	 */
	private async syncUser(user: User) {
		console.log('-------------------------- Sync User --------------------------', user);
		// First, let's search by user.externalUserId & user.externalTenantId (which is Gauzy userId)
		let userFilterByExternalFieldsQuery: DocumentNode<UserConnection> = gql`
			query userFilterByExternalFieldsQuery($externalUserIdFilter: String!, $externalTenantIdFilter: String!) {
				users(
					filter: {
						externalUserId: { eq: $externalUserIdFilter }
						externalTenantId: { eq: $externalTenantIdFilter }
					}
				) {
					edges {
						node {
							id
							email
							username
							externalUserId
							externalTenantId
						}
					}
					totalCount
				}
			}
		`;

		let usersQueryResult: ApolloQueryResult<Query> = await this._client.query<Query>({
			query: userFilterByExternalFieldsQuery,
			variables: {
				externalUserIdFilter: user.externalUserId,
				externalTenantIdFilter: user.externalTenantId
			}
		});

		try {
			// Check if there are any GraphQL errors
			if (usersQueryResult.errors && usersQueryResult.errors.length > 0) {
				// Handle GraphQL errors
				const [error] = usersQueryResult.errors;
				// You can also access error.extensions for additional error details

				// Use this (using the "options" parameter):
				throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
			}
			// Process the query result if successful
			// You can access the data via usersQueryResult.data
			let usersResponse = usersQueryResult.data.users.edges;
			let isAlreadyCreated = usersQueryResult.data.users.totalCount > 0;

			console.log(
				`Is User already exists in Gauzy AI: ${isAlreadyCreated} by externalUserId: %s and externalTenantId: %s fields`,
				user.externalUserId,
				user.externalTenantId
			);

			if (!isAlreadyCreated) {
				/** Create record of user */
				try {
					const createOneUserMutation: DocumentNode<any> = gql`
						mutation createOneUser($input: CreateOneUserInput!) {
							createOneUser(input: $input) {
								id
								firstName
								lastName
								email
								username
								hash
								externalTenantId
								externalUserId
								isActive
								isArchived
							}
						}
					`;
					const newUser = await this._client.mutate({
						mutation: createOneUserMutation,
						variables: {
							input: {
								user
							}
						}
					});
					return <User>newUser.data.createOneUser;
				} catch (error) {
					console.error('Error while creating user: %s', error?.message);
				}
			}

			console.log(usersResponse[0].node);
			/** Update record of user */
			try {
				const id = usersResponse[0].node.id;
				const updateUserMutation: DocumentNode<any> = gql`
					mutation updateOneUser($input: UpdateOneUserInput!) {
						updateOneUser(input: $input) {
							id
							firstName
							lastName
							email
							username
							hash
							externalTenantId
							externalUserId
							isActive
							isArchived
						}
					}
				`;
				const updateUserResponse = await this._client.mutate({
					mutation: updateUserMutation,
					variables: {
						input: {
							id: id,
							update: user
						}
					}
				});
				console.log(<User>updateUserResponse.data);
				return <User>updateUserResponse.data.updateOneUser;
			} catch (error) {
				console.error('Error while updating user: %s', error?.message);
				this._logger.error(`Error while updating user: ${error?.message}`);
			}
		} catch (error) {
			// Handle other types of errors (e.g., network errors)
			console.error('Non-Apollo Client Error while while synced user: %s', error?.message);
			// Use this (using the "options" parameter):
			throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Updates the API key of a tenant in the Gauzy AI service.
	 *
	 * @param input - The updated API key data.
	 * @returns The updated tenant API key information.
	 */
	public async updateOneTenantApiKey(input: UpdateTenantApiKey) {
		// Search for the tenant API key by its external API key
		let tenantApiKeyFilterByExternalFieldsQuery: DocumentNode<TenantApiKeyConnection> = gql`
			query tenantKeyFilterByExternalFieldsQuery($externalApiKeyFilter: String!) {
				tenantApiKeys(filter: { apiKey: { eq: $externalApiKeyFilter } }) {
					edges {
						node {
							id
							isActive
							isArchived
						}
					}
				}
			}
		`;

		let tenantApiKeysQueryResult: ApolloQueryResult<Query> = await this._client.query<Query>({
			query: tenantApiKeyFilterByExternalFieldsQuery,
			variables: {
				externalApiKeyFilter: input.apiKey
			}
		});

		try {
			// Check if there are any GraphQL errors
			if (tenantApiKeysQueryResult.errors && tenantApiKeysQueryResult.errors.length > 0) {
				// Handle GraphQL errors
				const [error] = tenantApiKeysQueryResult.errors;
				// You can also access error.extensions for additional error details

				// Use this (using the "options" parameter):
				throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
			}

			// Process the query result if successful
			// You can access the data via tenantApiKeysQueryResult.data
			let tenantApiKeysResponse = tenantApiKeysQueryResult.data.tenantApiKeys.edges;

			try {
				// Process the query result
				const id = tenantApiKeysResponse[0].node.id;

				// Update the tenant API key using a GraphQL mutation
				const updateOneTenantApiKeyMutation: DocumentNode<any> = gql`
					mutation updateOneTenantApiKey($input: UpdateOneTenantApiKeyInput!) {
						updateOneTenantApiKey(input: $input) {
							openAiSecretKey
							openAiOrganizationId
						}
					}
				`;

				const updateOneTenantApiKeyResponse = await this._client.mutate({
					mutation: updateOneTenantApiKeyMutation,
					variables: {
						input: {
							id: id,
							update: {
								openAiSecretKey: input.openAiSecretKey,
								openAiOrganizationId: input.openAiOrganizationId
							}
						}
					}
				});

				// Return the updated tenant API key information
				return <UpdateTenantApiKey>updateOneTenantApiKeyResponse.data.updateOneTenantApiKey;
			} catch (error) {
				console.error('Error while updating Tenant Api Key: %s', error?.message);
				this._logger.error(`Error while updating Tenant Api Key: ${error?.message}`);
			}
		} catch (error) {
			// Handle other types of errors (e.g., network errors)
			console.error('Non-Apollo Client Error while while synced Tenant Api Key: %s', error?.message);
			// Use this (using the "options" parameter):
			throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Retrieves a Tenant based on its external ID.
	 *
	 * @param externalTenantId - The external ID of the tenant.
	 * @returns A Promise resolving to the Tenant instance or null if not found.
	 */
	private async getTenantByExternalTenantId(externalTenantId: string): Promise<Tenant> {
		// Validate externalTenantId
		if (!externalTenantId) {
			throw new HttpException('External Tenant ID is required', HttpStatus.BAD_REQUEST);
		}

		// Define the GraphQL query outside the function
		const tenantByExternalTenantIdQuery: DocumentNode<TenantConnection> = gql`
			query tenantByExternalTenantId($externalTenantIdFilter: String!) {
				tenants(filter: { externalTenantId: { eq: $externalTenantIdFilter } }) {
					edges {
						node {
							id
							isActive
							isArchived
							name
							externalTenantId
						}
					}
					totalCount
				}
			}
		`;

		try {
			// Make the GraphQL query
			const tenantsQueryResult: ApolloQueryResult<Query> = await this._client.query<Query>({
				query: tenantByExternalTenantIdQuery,
				variables: {
					externalTenantIdFilter: externalTenantId
				}
			});

			// Check if there are any GraphQL errors
			if (tenantsQueryResult.errors && tenantsQueryResult.errors.length > 0) {
				// Handle GraphQL errors
				const [error] = tenantsQueryResult.errors;
				// You can also access error.extensions for additional error details

				// Use this (using the "options" parameter):
				throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
			}

			// Process the query result
			const tenantsResponse = tenantsQueryResult.data.tenants;
			if (tenantsResponse.totalCount > 0) {
				return tenantsResponse.edges[0].node;
			}
			return null;
		} catch (error) {
			// Handle other types of errors (e.g., network errors)
			console.error('Non-Apollo Client Error while getting tenant: %s', error?.message);
			// Use this (using the "options" parameter):
			throw new HttpException(error?.message, HttpStatus.BAD_REQUEST);
		}
	}
}
