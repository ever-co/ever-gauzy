import { IEmployee } from './employee.model';

export interface IGetEmployeeJobPostInput {
	employeeIds?: string[];
	search?: string;
	take?: number;
	skip?: number;
	budget?: [number, number];
	jobStatus?: JobPostStatusEnum[];
	jobSource?: JobPostSourceEnum[];
	jobType?: JobPostTypeEnum[];
}

export interface IEmployeeJobPost {
	employeeId: string;
	employee: IEmployee;
	jobPostId: string;
	isApplied?: boolean;
	appliedDate?: string;
	jobPost: IJobPost;
}

export interface IJobPost {
	jobPostId: string;
	id?: string;
	providerCode: string;
	providerJobId: string;
	title: string;
	description: string;
	jobDateCreated?: string;
	jobStatus?: JobPostStatusEnum;
	jobSource?: JobPostSourceEnum;
	jobType?: JobPostTypeEnum;
	url?: string;
	budget?: string;
	duration?: string;
	workload?: string;
	skills?: string;
	category?: string;
	subcategory?: string;
	country?: string;
	clientFeedback?: string;
	clientReviewsCount?: number;
	clientJobsPosted?: number;
	clientPastHires?: number;
	clientPaymentVerificationStatus?: boolean;

	searchCategory?: string;
	searchCategoryId?: string;
	searchOccupation?: string;
	searchOccupationId?: string;
	searchJobType?: string;
	searchKeyword?: string;
}

export enum JobPostSourceEnum {
	UPWORK = 'Upwork'
}

export enum JobPostStatusEnum {
	OPEN = 'Open',
	APPLIED = 'Applied',
	CLOSED = 'Closed'
}

export enum JobPostTypeEnum {
	HOURLY = 'Hourly',
	FIX_PRICE = 'Fixed Price'
}
