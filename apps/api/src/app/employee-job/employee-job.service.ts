import { Injectable } from '@nestjs/common';
import { IPagination } from '../core';
import { EmployeeJobPost } from './employee-job.entity';
import { getRandomEmployeeJobPosts } from './employee-job.seed';
import fetch from 'cross-fetch';

import {
	EmployeeJobPostsDocument,
	EmployeeJobPostsQuery
} from '@gauzy/integration-ai';
import {
	ApolloClient,
	HttpLink,
	InMemoryCache,
	gql
} from '@apollo/client/core';

@Injectable()
export class EmployeeJobPostService {
	public async findAll({
		where,
		relations
	}): Promise<IPagination<EmployeeJobPost>> {
		let jobs;

		// TODO: we should check here if we have Gauzy AI endpoint in the tenant settings.
		// If we don't have, we should use Random Seeds. Only if it's development environment, not in production!!!
		// In production it should just return null if Gauzy AI not configured

		// TODO: replace true with check of .env setting for GauzyAIGraphQLEndpoint
		if (true) {
			// TODO: move all below into @gauzy/integration-ai lib as separate service there.
			// But only that part related to GraphQL call of Gauzy AI API, not other logic.

			const client = new ApolloClient({
				typeDefs: EmployeeJobPostsDocument,
				link: new HttpLink({
					uri: 'http://localhost:3005/graphql', // TODO: use here endpoint from .env
					fetch
				}),
				cache: new InMemoryCache()
			});

			// TODO: use Query saved in SDK, not hard-code it here. Note: we may add much more fields to that query as we need more info!

			const result = await client.query<EmployeeJobPostsQuery>({
				query: gql`
					query employeeJobPosts {
						employeeJobPosts {
							edges {
								node {
									id
									employee {
										name
									}
									jobPost {
										title
									}
								}
							}
						}
					}
				`
			});

			jobs = result.data.employeeJobPosts.edges;

			// TODO: this jobs contains tons of GraphQL related fields. We should convert all that into Gauzy EmployeeJobPost and JobPost entities!
			// I.e. here should be mapping, we don't want to return result of GraphQL query here as is!
		} else {
			jobs = await getRandomEmployeeJobPosts();
		}

		console.log(JSON.stringify(jobs));

		return {
			items: jobs,
			total: jobs.length
		};
	}
}
