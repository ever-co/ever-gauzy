// import * as _ from 'underscore';
import { Injectable, Logger } from '@nestjs/common';
import {
	Employee,
	EmployeeJobPostsDocument,
	EmployeeJobPostsQuery,
	EmployeeQuery,
	UpdateEmployeeJobPost,
	UpworkJobsSearchCriterion
} from './sdk/gauzy-ai-sdk';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
import fetch from 'cross-fetch';
import {
	ApolloClient,
	ApolloQueryResult,
	NormalizedCacheObject,
	HttpLink,
	InMemoryCache,
	DefaultOptions,
	NetworkStatus,
	gql
} from '@apollo/client/core';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IEmployee,
	IVisibilityJobPostInput,
	IApplyJobPostInput,
	IUpdateEmployeeJobPostAppliedResult,
	IGetEmployeeJobPostInput,
	IPagination,
	IEmployeeJobPost,
	IJobPost,
	IGetEmployeeJobPostFilters,
	JobPostStatusEnum,
	JobPostTypeEnum,
	IEmployeeJobsStatistics
} from '@gauzy/models';

@Injectable()
export class GauzyAIService {
	private readonly _logger = new Logger(GauzyAIService.name);
	private _client: ApolloClient<NormalizedCacheObject>;

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

	private initClient() {
		this._client = new ApolloClient({
			typeDefs: EmployeeJobPostsDocument,
			link: new HttpLink({
				// TODO: use endpoint from .env. We probably should inject settings into constructor for this.
				uri: this.gauzyAIGraphQLEndpoint,
				fetch
			}),
			cache: new InMemoryCache(),
			defaultOptions: this.defaultOptions
		});
	}

	constructor() {
		try {
			// TODO: read from constructor injected parameter (e.g. config service)
			this.gauzyAIGraphQLEndpoint = process.env.GAUZY_AI_GRAPHQL_ENDPOINT;

			if (this.gauzyAIGraphQLEndpoint) {
				this._logger.log(
					'Gauzy AI Endpoint configured in the environment'
				);

				this.initClient();

				const testConnectionQuery = async () => {
					try {
						const employeesQuery: DocumentNode<EmployeeQuery> = gql`
							query employee {
								employees {
									edges {
										node {
											id
										}
									}
									totalCount
								}
							}
						`;

						const employeesQueryResult: ApolloQueryResult<EmployeeQuery> = await this._client.query<
							EmployeeQuery
						>({
							query: employeesQuery
						});

						if (
							employeesQueryResult.networkStatus ===
							NetworkStatus.error
						) {
							this._client = null;
						}
					} catch (err) {
						this._logger.error(err);
						this._client = null;
					}
				};

				testConnectionQuery();
			} else {
				this._logger.warn(
					'Gauzy AI Endpoint not configured in the environment'
				);
				this._client = null;
			}
		} catch (err) {
			this._logger.error(err);
			this._client = null;
		}
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
	public async updateEmployeeStatus(
		employeeId: string,
		isJobSearchActive: boolean
	): Promise<boolean> {
		if (this._client == null) {
			return false;
		}

		// First we need to get employee id because we have only externalId
		const gauzyAIEmployeeId = await this.getEmployeeGauzyAIId(employeeId);

		console.log(
			`updateVisibility called. EmployeeId: ${employeeId}. Gauzy AI EmployeeId: ${gauzyAIEmployeeId}`
		);

		return true;
	}

	/**
	 * Updates job visibility
	 * @param hide Should job be hidden or visible. This will set isActive field to false in Gauzy AI
	 * @param employeeId If employeeId set, job will be set not active only for that specific employee (using EmployeeJobPost record update in Gauzy AI)
	 * If employeeId is not set, job will be set not active for all employees (using JobPost record update in Gauzy AI)
	 * @param providerCode e.g. 'upwork'
	 * @param providerJobId Unique job id in the provider, e.g. in Upwork. If this value is not set, it will update ALL jobs for given provider
	 */
	public async updateVisibility(
		input: IVisibilityJobPostInput
	): Promise<boolean> {
		if (this._client == null) {
			return false;
		}

		// If it's for specific employee and specific job
		if (input.employeeId && input.providerCode && input.providerJobId) {
			// First we need to get employee id because we have only externalId
			const employeeId = await this.getEmployeeGauzyAIId(
				input.employeeId
			);

			console.log(`updateVisibility called. EmployeeId: ${employeeId}`);

			// Next we need to get a job using providerCode and providerJobId
			const jobPostId = await this.getJobPostId(
				input.providerCode,
				input.providerJobId
			);

			console.log(`updateVisibility called. jobPostId: ${jobPostId}`);

			// Next, we need to find `public employee job post` table record in Gauzy AI to get id of record.
			// We can find by employeeId and jobPostId

			const employeeJobPostId = await this.getEmployeeJobPostId(
				employeeId,
				jobPostId
			);

			console.log(
				`updateVisibility called. employeeJobPostId: ${employeeJobPostId}`
			);

			if (employeeId && jobPostId && employeeJobPostId) {
				const update: UpdateEmployeeJobPost = {
					employeeId: employeeId,
					jobPostId: jobPostId,
					isActive: !input.hide,
					isArchived: input.hide
				};

				const updateEmployeeJobPostMutation: DocumentNode<any> = gql`
					mutation updateOneEmployeeJobPost(
						$input: UpdateOneEmployeeJobPostInput!
					) {
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
	 * Updates if Employee Applied to a job
	 * @param applied This will set isApplied and appliedDate fields in Gauzy AI
	 * @param employeeId Employee who applied for a job
	 * @param providerCode e.g. 'upwork'
	 * @p  aram providerJobId Unique job id in the provider, e.g. in Upwork
	 */
	public async updateApplied(
		input: IApplyJobPostInput
	): Promise<IUpdateEmployeeJobPostAppliedResult> {
		if (this._client == null) {
			return { isRedirectRequired: true };
		}

		// First we need to get employee id because we have only externalId
		const employeeId = await this.getEmployeeGauzyAIId(input.employeeId);

		console.log(`updateApplied called. EmployeeId: ${employeeId}`);

		// Next we need to get a job using providerCode and providerJobId
		const jobPostId = await this.getJobPostId(
			input.providerCode,
			input.providerJobId
		);

		console.log(`updateApplied called. jobPostId: ${jobPostId}`);

		// Next, we need to find `public employee job post` table record in Gauzy AI to get id of record.
		// We can find by employeeId and jobPostId

		const employeeJobPostId = await this.getEmployeeJobPostId(
			employeeId,
			jobPostId
		);

		console.log(
			`updateApplied called. employeeJobPostId: ${employeeJobPostId}`
		);

		if (employeeId && jobPostId && employeeJobPostId) {
			const update: UpdateEmployeeJobPost = {
				employeeId: employeeId,
				jobPostId: jobPostId,
				isApplied: input.applied
			};

			const updateEmployeeJobPostMutation: DocumentNode<any> = gql`
				mutation updateOneEmployeeJobPost(
					$input: UpdateOneEmployeeJobPostInput!
				) {
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
			const gauzyAIEmployee: Employee = await this.syncEmployee({
				externalEmployeeId: employee.id,
				isActive: employee.isActive,
				isArchived: false,
				upworkJobSearchCriteria: undefined,
				upworkJobSearchCriteriaAggregate: undefined,
				firstName: employee.user.firstName,
				lastName: employee.user.lastName
			});

			console.log(`Synced Employee ${JSON.stringify(gauzyAIEmployee)}`);

			// let's delete all criteria for Employee

			const deleteAllCriteriaMutation: DocumentNode<any> = gql`
				mutation deleteManyUpworkJobsSearchCriteria(
					$input: DeleteManyUpworkJobsSearchCriteriaInput!
				) {
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
							employeeId: {
								eq: gauzyAIEmployee.id
							}
						}
					}
				}
			});

			console.log(
				`Delete Existed Criterions count: ${JSON.stringify(
					deleteMutationResult.data.deleteManyUpworkJobsSearchCriteria
						.deletedCount
				)}`
			);

			// now let's create new criteria in Gauzy AI based on Gauzy criterions data

			if (criteria && criteria.length > 0) {
				const gauzyAICriteria: UpworkJobsSearchCriterion[] = [];

				criteria.forEach(
					(criterion: IEmployeeUpworkJobsSearchCriterion) => {
						gauzyAICriteria.push({
							employee: undefined,
							employeeId: gauzyAIEmployee.id,
							isActive: true,
							isArchived: false,
							jobType: 'hourly', // TODO: criterion.jobType
							keyword: criterion.keyword,
							category: criterion.category?.name,
							categoryId: criterion.categoryId,
							occupation: criterion.occupation?.name,
							occupationId: criterion.occupationId
						});
					}
				);

				const createCriteriaMutation: DocumentNode<any> = gql`
					mutation createManyUpworkJobsSearchCriteria(
						$input: CreateManyUpworkJobsSearchCriteriaInput!
					) {
						createManyUpworkJobsSearchCriteria(input: $input) {
							id
						}
					}
				`;

				const createNewCriteriaResult = await this._client.mutate({
					mutation: createCriteriaMutation,
					variables: {
						input: {
							upworkJobsSearchCriteria: gauzyAICriteria
						}
					}
				});

				console.log(
					`Create New Criteria result: ${JSON.stringify(
						createNewCriteriaResult.data
							.createManyUpworkJobsSearchCriteria
					)}`
				);
			}

			return true;
		} catch (err) {
			this._logger.error(err);
			return false;
		}
	}

	/**
	 *
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

		await Promise.all(
			employees.map(async (employee) => {
				try {
					const gauzyAIEmployee: Employee = await this.syncEmployee({
						externalEmployeeId: employee.id,
						isActive: employee.isActive,
						isArchived: false,
						upworkJobSearchCriteria: undefined,
						upworkJobSearchCriteriaAggregate: undefined,
						firstName: employee.user.firstName,
						lastName: employee.user.lastName
					});

					console.log(
						`Synced Employee ${JSON.stringify(gauzyAIEmployee)}`
					);
				} catch (err) {
					this._logger.error(err);
				}
			})
		);

		return true;
	}

	private async getEmployeeJobPostId(
		employeeId: string,
		jobPostId: string
	): Promise<string> {
		const employeeJobPostsQuery = gql`
			query employeeJobPostsByEmployeeIdJobPostId(
				$employeeIdFilter: String!
				$jobPostIdFilter: String!
			) {
				employeeJobPosts(
					filter: {
						employeeId: { eq: $employeeIdFilter }
						jobPostId: { eq: $jobPostIdFilter }
					}
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

		const employeeJobPostsResponse =
			employeeJobPostsQueryResult.data.employeeJobPosts.edges;

		if (employeeJobPostsResponse && employeeJobPostsResponse.length > 0) {
			return employeeJobPostsResponse[0].node.id;
		}

		return null;
	}

	private async getJobPostId(
		providerCode: string,
		providerJobId: string
	): Promise<string> {
		const jobPostsQuery = gql`
			query jobPosts(
				$providerCodeFilter: String!
				$providerJobIdFilter: String!
			) {
				jobPosts(
					filter: {
						providerCode: { eq: $providerCodeFilter }
						providerJobId: { eq: $providerJobIdFilter }
					}
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

	private async getEmployeeGauzyAIId(
		externalEmployeeId: string
	): Promise<string> {
		const employeesQuery: DocumentNode<EmployeeQuery> = gql`
			query employeeByExternalEmployeeId(
				$externalEmployeeIdFilter: String!
			) {
				employees(
					filter: {
						externalEmployeeId: { eq: $externalEmployeeIdFilter }
					}
				) {
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

		const employeesQueryResult: ApolloQueryResult<EmployeeQuery> = await this._client.query<
			EmployeeQuery
		>({
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

	/** Sync Employee between Gauzy and Gauzy AI
	 *  Creates new Employee in Gauzy AI if it's not yet exists there yet (it try to find by externalEmployeeId field value or by name)
	 *  Update existed Gauzy AI Employee record with new data from Gauzy DB
	 */
	private async syncEmployee(employee: Employee): Promise<Employee> {
		// First, let's search by employee.externalEmployeeId (which is Gauzy employeeId)

		let employeesQuery: DocumentNode<EmployeeQuery> = gql`
			query employeeByExternalEmployeeId(
				$externalEmployeeIdFilter: String!
			) {
				employees(
					filter: {
						externalEmployeeId: { eq: $externalEmployeeIdFilter }
					}
				) {
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

		let employeesQueryResult: ApolloQueryResult<EmployeeQuery> = await this._client.query<
			EmployeeQuery
		>({
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
				query employeeByName(
					$firstNameFilter: String!
					$lastNameFilter: String!
				) {
					employees(
						filter: {
							firstName: { eq: $firstNameFilter }
							lastName: { eq: $lastNameFilter }
						}
					) {
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
					mutation createOneEmployee(
						$input: CreateOneEmployeeInput!
					) {
						createOneEmployee(input: $input) {
							id
							externalEmployeeId
							firstName
							lastName
						}
					}
				`;

				const newEmployee = await this._client.mutate({
					mutation: createEmployeeMutation,
					variables: {
						input: {
							employee
						}
					}
				});

				return newEmployee.data.createOneEmployee;
			}
		}

		// update record of employee

		const id = employeesResponse[0].node.id;

		const updateEmployeeMutation: DocumentNode<any> = gql`
			mutation updateOneEmployee($input: UpdateOneEmployeeInput!) {
				updateOneEmployee(input: $input) {
					externalEmployeeId
					isActive
					isArchived
					firstName
					lastName
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
	}

	/**
	 * Get Jobs available for registered employees
	 */
	public async getEmployeesJobPosts(
		data: IGetEmployeeJobPostInput
	): Promise<IPagination<IEmployeeJobPost>> {
		if (this._client == null) {
			return null;
		}

		console.log(`getEmployeesJobPosts. Data ${JSON.stringify(data)}`);

		const filters: IGetEmployeeJobPostFilters = data.filters
			? JSON.parse(<any>data.filters)
			: undefined;

		console.log(`getEmployeesJobPosts. Filters ${JSON.stringify(filters)}`);

		const employeeIdFilter =
			filters && filters.employeeIds && filters.employeeIds.length > 0
				? filters.employeeIds[0]
				: undefined;

		try {
			// TODO: use Query saved in SDK, not hard-code it here. Note: we may add much more fields to that query as we need more info!
			const employeesQuery: DocumentNode<EmployeeJobPostsQuery> = gql`
				query employeeJobPosts(
					$after: ConnectionCursor!
					$first: Int!
					$filter: EmployeeJobPostFilter!
					$sorting: [EmployeeJobPostSort!]
				) {
					employeeJobPosts(
						paging: { after: $after, first: $first }
						filter: $filter
						sorting: $sorting
					) {
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
								}
							}
						}
					}
				}
			`;

			const jobResponses: IEmployeeJobPost[] = [];

			let isContinue: boolean;
			let after = '';

			const filter = {
				isActive: {
					is: true
				},
				isArchived: {
					is: false
				},
				employeeId: undefined
			};

			if (employeeIdFilter) {
				const employeeId = await this.getEmployeeGauzyAIId(
					employeeIdFilter
				);

				filter.employeeId = {
					eq: employeeId
				};
			}

			console.log(`Applying filter: ${JSON.stringify(filter)}`);

			const graphQLPageSize = 50;

			// e.g. if it's page 7 and limit is 10, it mean we need to load first 70 records, i.e. do 2 trips to server because each trip get 50 records
			const loadCounts = Math.ceil(
				(data.page * data.limit) / graphQLPageSize
			);

			console.log(`Round trips to Gauzy API: ${loadCounts}`);

			let currentCount = 1;

			let totalCount;

			do {
				const result: ApolloQueryResult<EmployeeJobPostsQuery> = await this._client.query<
					EmployeeJobPostsQuery
				>({
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

				const jobsResponse = result.data.employeeJobPosts.edges.map(
					(it) => {
						const rec = it.node;

						const res: IEmployeeJobPost = {
							employeeId: rec.employee.externalEmployeeId,
							employee: undefined,
							jobPostId: rec.jobPost.id,
							jobPost: <IJobPost>rec.jobPost,

							jobDateCreated: rec.jobDateCreated,
							providerCode: rec.providerCode,
							providerJobId: rec.providerJobId,
							jobStatus: rec.jobStatus
								? JobPostStatusEnum[rec.jobStatus]
								: undefined,
							jobType: rec.jobType
								? JobPostTypeEnum[rec.jobType]
								: undefined,

							isApplied: rec.isApplied,
							appliedDate: rec.appliedDate,
							isActive: rec.isActive,
							isArchived: rec.isArchived,
							createdAt: rec.createdAt,
							updatedAt: rec.updatedAt
						};

						return res;
					}
				);

				isContinue =
					result.data.employeeJobPosts.pageInfo.hasNextPage &&
					currentCount < loadCounts;
				after = result.data.employeeJobPosts.pageInfo.endCursor;
				totalCount = result.data.employeeJobPosts.totalCount;

				jobResponses.push(...jobsResponse);

				console.log(
					`Found ${jobsResponse.length} job records. IsContinue: ${isContinue}. After: ${after}`
				);

				currentCount++;
			} while (isContinue);

			// Note: possible to do additional client side filtering like below:
			// jobResponses = _.filter(jobResponses, (it) => it.isActive === true && it.isArchived === false);

			console.log(
				`getEmployeesJobPosts. Total Count: ${totalCount}. Page ${data.page}`
			);

			const response: IPagination<IEmployeeJobPost> = {
				items: this.paginate(jobResponses, data.limit, data.page),
				total: totalCount
			};

			// console.log(`Found Records: ${JSON.stringify(response)}`);

			return response;
		} catch (err) {
			this._logger.error(err);
			return null;
		}
	}

	private paginate(array, page_size, page_number) {
		// human-readable page numbers usually start with 1, so we reduce 1 in the first argument
		return array.slice(
			(page_number - 1) * page_size,
			page_number * page_size
		);
	}
}
