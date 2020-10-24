import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';
import * as faker from 'faker';
import {
	IEmployee,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/models';

export const getRandomEmployeeJobPosts = async (
	employees?: IEmployee[],
	limit = 10
): Promise<EmployeeJobPost[]> => {
	const employeesJobs: EmployeeJobPost[] = [];

	for (let i = 0; i < limit; i++) {
		const employee = faker.random.arrayElement(employees);
		const jobPostEmployee = new EmployeeJobPost({
			employeeId: employee ? employee.id : null,
			employee: employee
		});

		const job = new JobPost({
			country: faker.address.country(),
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

	return employeesJobs;
};
