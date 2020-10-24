import { Injectable } from '@nestjs/common';
import { IPagination } from '../core';
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
import { Employee } from '../employee/employee.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IJobPost
} from '@gauzy/models';
import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';

@Injectable()
export class EmployeeJobPostService {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	public async findAll(
		data: IGetEmployeeJobPostInput
	): Promise<IPagination<IEmployeeJobPost>> {
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

			const jobsResponse = result.data.employeeJobPosts.edges;

			// TODO: let's load here all employees from given tenant who active
			const employees = await this.employeeRepository.find();

			jobs = await Promise.all(
				jobsResponse.map(async (jo) => {
					const j = jo.node;
					const job = new EmployeeJobPost();
					job.employeeId = j.employee.externalEmployeeId;
					job.isApplied = j.isApplied;
					job.appliedDate = j.appliedDate;
					// TODO: here should be code to find one employee by j.employee.externalEmployeeId.
					// But because that values come for now as null, we just use first employee for now
					job.employee = employees[0];
					(job.jobPostId = j.jobPost.id),
						(job.jobPost = <JobPost>j.jobPost);

					return job;
				})
			);

			// TODO: this jobs contains tons of GraphQL related fields. We should convert all that into Gauzy EmployeeJobPost and JobPost entities!
			// I.e. here should be mapping, we don't want to return result of GraphQL query here as is!
		} else {
			const employees = await this.employeeRepository.find({
				relations: ['user']
			});
			jobs = await getRandomEmployeeJobPosts(employees, data.take);
		}

		return {
			items: jobs,
			total: jobs.length
		};
	}
}
