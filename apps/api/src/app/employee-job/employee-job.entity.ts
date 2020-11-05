import {
	IEmployeeJobPost,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/models';
import { Model } from '../core/entities/base';
import { Employee } from '../employee/employee.entity';
import { JobPost } from './jobPost.entity';

export class EmployeeJobPost extends Model implements IEmployeeJobPost {
	employeeId: string;
	employee: Employee;
	jobPostId: string;
	isApplied?: boolean;
	appliedDate?: Date;

	jobPost: JobPost;

	// we de-normalize this fields for faster processing
	jobDateCreated?: Date;
	jobStatus?: JobPostStatusEnum;
	jobSource?: JobPostSourceEnum;
	jobType?: JobPostTypeEnum;

	providerCode: string; // same as jobSource field, but as a string, e.g. 'upwork'
	// unique ID of job in the source (e.g. in Upwork)
	providerJobId: string;

	createdAt?: Date;
	updatedAt?: Date;
	isActive: boolean;
	isArchived: boolean;
}
