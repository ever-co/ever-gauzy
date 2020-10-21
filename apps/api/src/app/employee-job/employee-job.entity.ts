import { Employee } from '../employee/employee.entity';
import { JobPost } from './jobPost.entity';

export class EmployeeJobPost {
	employeeId: string;
	employee: Employee;
	jobPostId: string;
	isApplied?: boolean;
	appliedDate?: string;
	jobPost: JobPost;
}
