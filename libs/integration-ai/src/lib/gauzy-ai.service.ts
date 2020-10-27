import { Injectable } from '@nestjs/common';
import {
	CreateOneEmployeeInput,
	Employee,
	EmployeeJobPostsDocument,
	EmployeeJobPostsQuery,
	EmployeeQuery,
	UpdateOneEmployeeInput,
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
	gql
} from '@apollo/client/core';

@Injectable()
export class GauzyAIService {
	private _client: ApolloClient<NormalizedCacheObject>;

	constructor() {
		this._client = new ApolloClient({
			typeDefs: EmployeeJobPostsDocument,
			link: new HttpLink({
				// TODO: use endpoint from .env. We probably should inject settings into constructor for this.
				uri: 'http://localhost:3005/graphql',
				fetch
			}),
			cache: new InMemoryCache()
		});
	}

	/** Sync Employee between Gauzy and Gauzy AI
	 *  Creates new Employee in Gauzy AI if it's not yet exists there yet (it try to find by externalEmployeeId field value)
	 *  Update existed Gauzy AI Employee record with new data from Gauzy DB
	 */
	public async syncEmployee(employee: Employee): Promise<boolean> {
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
			const createEmployeeMutation: DocumentNode<CreateOneEmployeeInput> = gql`
				mutation createOneEmployee($input: CreateOneEmployeeInput!) {
					createOneEmployee(input: $input) {
						externalEmployeeId
						firstName
						lastName
					}
				}
			`;

			await this._client.mutate({
				mutation: createEmployeeMutation,
				variables: {
					input: {
						employee
					}
				}
			});
		} else {
			// update record of employee

			const id = employeesResponse[0].node.id;

			const updateEmployeeMutation: DocumentNode<UpdateOneEmployeeInput> = gql`
				mutation updateOneEmployee($input: UpdateOneEmployeeInput!) {
					updateOneEmployee(input: $input) {
						id
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
		}

		return true;
	}

	/**
	 * Get Jobs available for registered employees
	 */
	public async getEmployeesJobPosts(): Promise<
		ApolloQueryResult<EmployeeJobPostsQuery>
	> {
		/*
		const employeeGauzyId = 'po333';

		const criteria: UpworkJobsSearchCriterion[] = [
			{
				keyword: 'yo',
				employeeId: employeeGauzyId,
				jobType: 'hourly',
				category: 'cat',
				categoryId: 'cat_id',
				occupation: 'occ',
				occupationId: 'occ_id',
				employee: undefined
			}
		];

		await this.syncEmployee({
			firstName: 'yo66666',
			lastName: 'yo',
			externalEmployeeId: employeeGauzyId,
			upworkJobSearchCriteria: undefined,
			upworkJobSearchCriteriaAggregate: undefined
		});
		*/

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
	}
}
