import {
	IJobPost,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/common';
import { Model } from '../base';

export class JobPost extends Model implements IJobPost {
	jobPostId: string;
	id?: string;
	providerCode: string;
	providerJobId: string;
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
