import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';
import * as faker from 'faker';
import {
	ICountry,
	IEmployee,
	IEmployeeJobPost,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/contracts';
import { IPagination } from '../core';
import { Country } from '../country';
import { getConnection } from 'typeorm';

export const getRandomEmployeeJobPosts = async (
	employees?: IEmployee[],
	page = 0,
	limit = 10
): Promise<IPagination<IEmployeeJobPost>> => {
	const countries: ICountry[] = await getConnection().manager.find(Country);
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
};
