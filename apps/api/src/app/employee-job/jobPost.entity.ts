export class JobPost {
	jobPostId: string;
	id?: string;
	providerCode: string;
	providerJobId: string;
	title: string;
	description: string;
	jobDateCreated?: string;
	jobStatus?: string;
	jobType?: string;
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
