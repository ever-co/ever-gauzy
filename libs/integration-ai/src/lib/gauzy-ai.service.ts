import { Injectable } from '@nestjs/common';
import {
	EmployeeJobPostsDocument,
	EmployeeJobPostsQuery
} from './sdk/gauzy-ai-sdk';
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

	public async getEmployeesJobPosts(): Promise<
		ApolloQueryResult<EmployeeJobPostsQuery>
	> {
		// TODO: use Query saved in SDK, not hard-code it here. Note: we may add much more fields to that query as we need more info!

		const result: ApolloQueryResult<EmployeeJobPostsQuery> = await this._client.query<
			EmployeeJobPostsQuery
		>({
			query: gql`
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
			`
		});

		return result;
	}
}
