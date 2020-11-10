import { IEmployee } from './employee.model';

export interface IGetEmployeeJobPostInput {
	page?: number;
	order?: 'ASC' | 'DESC';
	orderBy?: string;
	limit?: number;
	filters: IGetEmployeeJobPostFilters;
}

export interface IApplyJobPostInput {
	applied: boolean;
	employeeId: string;
	providerCode: string;
	providerJobId: string;
}

export interface IVisibilityJobPostInput {
	hide: boolean;
	employeeId?: string | undefined;
	providerCode?: string | undefined;
	providerJobId?: string | undefined;
}

export interface IGetEmployeeJobPostFilters {
	search?: string;
	employeeIds?: string[];
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
	appliedDate?: Date;
	jobPost: IJobPost;

	// we de-normalize this fields for faster processing
	jobDateCreated?: Date;
	jobStatus?: JobPostStatusEnum;
	jobSource?: JobPostSourceEnum;
	providerCode: string; // same as jobSource field, but as a string, e.g. 'upwork'
	// unique ID of job in the source (e.g. in Upwork)
	providerJobId: string;
	jobType?: JobPostTypeEnum;

	createdAt?: Date;
	updatedAt?: Date;
	isActive: boolean;
	isArchived: boolean;
}

export interface IJobPost {
	jobPostId: string;
	id?: string;
	providerCode: string; // same as jobSource field, but as a string, e.g. 'upwork'
	providerJobId: string; // unique ID of job in the source (e.g. in Upwork)
	title: string;
	description: string;
	jobDateCreated?: Date;
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

	createdAt?: Date;
	updatedAt?: Date;
	isActive: boolean;
	isArchived: boolean;
}

export enum JobPostSourceEnum {
	UPWORK = 'Upwork',
	WEB = 'Web'
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

export interface IUpdateEmployeeJobPostAppliedResult {
	isRedirectRequired: boolean;
}
