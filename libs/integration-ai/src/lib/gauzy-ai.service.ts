import { Injectable, Logger } from '@nestjs/common';
import {
	Employee,
	EmployeeJobPostsDocument,
	EmployeeJobPostsQuery,
	EmployeeQuery,
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
import { EmployeeUpworkJobsSearchCriterion, IEmployee } from '@gauzy/models';

@Injectable()
export class GauzyAIService {
	private readonly _logger = new Logger(GauzyAIService.name);
	private _client: ApolloClient<NormalizedCacheObject>;

	constructor() {
		try {
			// TODO: read from constructor injected parameter (e.g. config service)
			const gauzyAIGraphQLEndpoint =
				process.env.GAUZY_AI_GRAPHQL_ENDPOINT;

			if (gauzyAIGraphQLEndpoint) {
				this._logger.log(
					'Gauzy AI Endpoint configured in the environment'
				);

				// For now, we disable Apollo client caching for all GraphQL queries and mutations
				const defaultOptions: DefaultOptions = {
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

				this._client = new ApolloClient({
					typeDefs: EmployeeJobPostsDocument,
					link: new HttpLink({
						// TODO: use endpoint from .env. We probably should inject settings into constructor for this.
						uri: gauzyAIGraphQLEndpoint,
						fetch
					}),
					cache: new InMemoryCache(),
					defaultOptions
				});

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
		criteria: EmployeeUpworkJobsSearchCriterion[]
	): Promise<boolean> {
		if (this._client == null) {
			return false;
		}

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

		const gauzyAICriteria: UpworkJobsSearchCriterion[] = [];

		criteria.forEach((criterion: EmployeeUpworkJobsSearchCriterion) => {
			gauzyAICriteria.push({
				employee: undefined,
				employeeId: gauzyAIEmployee.id,
				isActive: true,
				isArchived: false,
				jobType: 'hourly', // TODO: criterion.jobType
				keyword: criterion.keyword,
				category: criterion.jobSearchCategory?.name,
				categoryId: criterion.jobSearchCategoryId,
				occupation: criterion.jobSearchOccupation?.name,
				occupationId: criterion.jobSearchOccupationId
			});
		});

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
				createNewCriteriaResult.data.createManyUpworkJobsSearchCriteria
			)}`
		);

		return true;
	}

	/** Sync Employee between Gauzy and Gauzy AI
	 *  Creates new Employee in Gauzy AI if it's not yet exists there yet (it try to find by externalEmployeeId field value)
	 *  Update existed Gauzy AI Employee record with new data from Gauzy DB
	 */
	private async syncEmployee(employee: Employee): Promise<Employee> {
		// TODO: replace <any> with <EmployeeQuery>

		const employeesQuery: DocumentNode<EmployeeQuery> = gql`
			query employee($externalEmployeeIdFilter: String!) {
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
				externalEmployeeIdFilter: employee.externalEmployeeId
			}
		});

		const employeesResponse = employeesQueryResult.data.employees.edges;

		const isAlreadyCreated = employeesResponse.length > 0;

		console.log(
			`Is Employee ${employee.externalEmployeeId} already exists in Gauzy AI: ${isAlreadyCreated}`
		);

		if (!isAlreadyCreated) {
			const createEmployeeMutation: DocumentNode<any> = gql`
				mutation createOneEmployee($input: CreateOneEmployeeInput!) {
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
		} else {
			// update record of employee

			const id = employeesResponse[0].node.id;

			const updateEmployeeMutation: DocumentNode<any> = gql`
				mutation updateOneEmployee($input: UpdateOneEmployeeInput!) {
					updateOneEmployee(input: $input) {
						id
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
	}

	/**
	 * Get Jobs available for registered employees
	 */
	public async getEmployeesJobPosts(): Promise<
		ApolloQueryResult<EmployeeJobPostsQuery>
	> {
		if (this._client == null) {
			return null;
		}

		try {
			// TODO: use Query saved in SDK, not hard-code it here. Note: we may add much more fields to that query as we need more info!
			const employeesQuery: DocumentNode<EmployeeJobPostsQuery> = gql`
				query employeeJobPosts {
					employeeJobPosts {
						edges {
							node {
								id
								isApplied
								appliedDate
								employee {
									externalEmployeeId
								}
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

			const result: ApolloQueryResult<EmployeeJobPostsQuery> = await this._client.query<
				EmployeeJobPostsQuery
			>({
				query: employeesQuery
			});

			return result;
		} catch (err) {
			this._logger.error(err);
			return null;
		}
	}
}
