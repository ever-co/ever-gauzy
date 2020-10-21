import { EmployeeJobPost } from './employee-job.entity';
import { JobPost } from './jobPost.entity';
import * as faker from 'faker';

export const getRandomEmployeeJobPosts = async (
	employeeId: string = null
): Promise<EmployeeJobPost[]> => {
	const employeesJobs: EmployeeJobPost[] = [];

	for (let i = 0; i < 10; i++) {
		const jobPostEmployee = new EmployeeJobPost();

		if (employeeId) {
			jobPostEmployee.employeeId = employeeId;
			// TODO: jobPostEmployee.employee = ... load here from DB
		}

		// TODO: select randomly one of existed employees here from current organizationId / tenantId if employeeId parameter is null
		// jobPostEmployee.employee = ...
		// jobPostEmployee.employeeId = ...

		const job = new JobPost();
		job.country = faker.address.country();
		job.category = faker.name.jobTitle();
		job.title = faker.name.jobDescriptor();
		job.description = faker.lorem.sentences(3);

		jobPostEmployee.jobPost = job;

		employeesJobs.push(jobPostEmployee);
	}

	return employeesJobs;
};
