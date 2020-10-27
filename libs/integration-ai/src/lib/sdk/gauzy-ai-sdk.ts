import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
	[K in keyof T]: T[K];
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
	ID: string;
	String: string;
	Boolean: boolean;
	Int: number;
	Float: number;
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
	DateTime: any;
	/** Cursor for paging through collections */
	ConnectionCursor: any;
};

export type UpworkJobsSearchCriterion = {
	__typename?: 'UpworkJobsSearchCriterion';
	id?: Maybe<Scalars['ID']>;
	employeeId: Scalars['String'];
	category?: Maybe<Scalars['String']>;
	categoryId?: Maybe<Scalars['String']>;
	occupation?: Maybe<Scalars['String']>;
	occupationId?: Maybe<Scalars['String']>;
	jobType: Scalars['String'];
	keyword: Scalars['String'];
	employee: Employee;
};

export type Employee = {
	__typename?: 'Employee';
	id?: Maybe<Scalars['ID']>;
	externalEmployeeId?: Maybe<Scalars['String']>;
	firstName?: Maybe<Scalars['String']>;
	lastName?: Maybe<Scalars['String']>;
	name?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	upworkJobSearchCriteria: Array<UpworkJobsSearchCriterion>;
	upworkJobSearchCriteriaAggregate: EmployeeUpworkJobSearchCriteriaAggregateResponse;
};

export type EmployeeUpworkJobSearchCriteriaArgs = {
	paging?: Maybe<OffsetPaging>;
	filter?: Maybe<UpworkJobsSearchCriterionFilter>;
	sorting?: Maybe<Array<UpworkJobsSearchCriterionSort>>;
};

export type EmployeeUpworkJobSearchCriteriaAggregateArgs = {
	filter?: Maybe<UpworkJobsSearchCriterionAggregateFilter>;
};

export type OffsetPaging = {
	/** Limit the number of records returned */
	limit?: Maybe<Scalars['Int']>;
	/** Offset to start returning records from */
	offset?: Maybe<Scalars['Int']>;
};

export type UpworkJobsSearchCriterionFilter = {
	and?: Maybe<Array<UpworkJobsSearchCriterionFilter>>;
	or?: Maybe<Array<UpworkJobsSearchCriterionFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type BooleanFieldComparison = {
	is?: Maybe<Scalars['Boolean']>;
	isNot?: Maybe<Scalars['Boolean']>;
};

export type IdFilterComparison = {
	is?: Maybe<Scalars['Boolean']>;
	isNot?: Maybe<Scalars['Boolean']>;
	eq?: Maybe<Scalars['ID']>;
	neq?: Maybe<Scalars['ID']>;
	gt?: Maybe<Scalars['ID']>;
	gte?: Maybe<Scalars['ID']>;
	lt?: Maybe<Scalars['ID']>;
	lte?: Maybe<Scalars['ID']>;
	like?: Maybe<Scalars['ID']>;
	notLike?: Maybe<Scalars['ID']>;
	iLike?: Maybe<Scalars['ID']>;
	notILike?: Maybe<Scalars['ID']>;
	in?: Maybe<Array<Scalars['ID']>>;
	notIn?: Maybe<Array<Scalars['ID']>>;
};

export type UpworkJobsSearchCriterionSort = {
	field: UpworkJobsSearchCriterionSortFields;
	direction: SortDirection;
	nulls?: Maybe<SortNulls>;
};

export enum UpworkJobsSearchCriterionSortFields {
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	Id = 'id'
}

/** Sort Directions */
export enum SortDirection {
	Asc = 'ASC',
	Desc = 'DESC'
}

/** Sort Nulls Options */
export enum SortNulls {
	NullsFirst = 'NULLS_FIRST',
	NullsLast = 'NULLS_LAST'
}

export type UpworkJobsSearchCriterionAggregateFilter = {
	and?: Maybe<Array<UpworkJobsSearchCriterionAggregateFilter>>;
	or?: Maybe<Array<UpworkJobsSearchCriterionAggregateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type JobPost = {
	__typename?: 'JobPost';
	id?: Maybe<Scalars['ID']>;
	providerCode: Scalars['String'];
	providerJobId: Scalars['String'];
	title: Scalars['String'];
	description: Scalars['String'];
	jobDateCreated?: Maybe<Scalars['DateTime']>;
	jobStatus?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	url?: Maybe<Scalars['String']>;
	budget?: Maybe<Scalars['String']>;
	duration?: Maybe<Scalars['String']>;
	workload?: Maybe<Scalars['String']>;
	skills?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	subcategory?: Maybe<Scalars['String']>;
	country?: Maybe<Scalars['String']>;
	clientFeedback?: Maybe<Scalars['String']>;
	clientReviewsCount?: Maybe<Scalars['Float']>;
	clientJobsPosted?: Maybe<Scalars['Float']>;
	clientPastHires?: Maybe<Scalars['Float']>;
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']>;
	searchCategory?: Maybe<Scalars['String']>;
	searchCategoryId?: Maybe<Scalars['String']>;
	searchOccupation?: Maybe<Scalars['String']>;
	searchOccupationId?: Maybe<Scalars['String']>;
	searchJobType?: Maybe<Scalars['String']>;
	searchKeyword?: Maybe<Scalars['String']>;
};

export type EmployeeJobPost = {
	__typename?: 'EmployeeJobPost';
	id?: Maybe<Scalars['ID']>;
	employeeId: Scalars['String'];
	jobPostId: Scalars['String'];
	isApplied?: Maybe<Scalars['Boolean']>;
	appliedDate?: Maybe<Scalars['DateTime']>;
	jobPost: JobPost;
	employee: Employee;
};

export type DeleteManyResponse = {
	__typename?: 'DeleteManyResponse';
	/** The number of records deleted. */
	deletedCount: Scalars['Int'];
};

export type JobPostDeleteResponse = {
	__typename?: 'JobPostDeleteResponse';
	id?: Maybe<Scalars['ID']>;
	providerCode?: Maybe<Scalars['String']>;
	providerJobId?: Maybe<Scalars['String']>;
	title?: Maybe<Scalars['String']>;
	description?: Maybe<Scalars['String']>;
	jobDateCreated?: Maybe<Scalars['DateTime']>;
	jobStatus?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	url?: Maybe<Scalars['String']>;
	budget?: Maybe<Scalars['String']>;
	duration?: Maybe<Scalars['String']>;
	workload?: Maybe<Scalars['String']>;
	skills?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	subcategory?: Maybe<Scalars['String']>;
	country?: Maybe<Scalars['String']>;
	clientFeedback?: Maybe<Scalars['String']>;
	clientReviewsCount?: Maybe<Scalars['Float']>;
	clientJobsPosted?: Maybe<Scalars['Float']>;
	clientPastHires?: Maybe<Scalars['Float']>;
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']>;
	searchCategory?: Maybe<Scalars['String']>;
	searchCategoryId?: Maybe<Scalars['String']>;
	searchOccupation?: Maybe<Scalars['String']>;
	searchOccupationId?: Maybe<Scalars['String']>;
	searchJobType?: Maybe<Scalars['String']>;
	searchKeyword?: Maybe<Scalars['String']>;
};

export type UpdateManyResponse = {
	__typename?: 'UpdateManyResponse';
	/** The number of records updated. */
	updatedCount: Scalars['Int'];
};

export type JobPostEdge = {
	__typename?: 'JobPostEdge';
	/** The node containing the JobPost */
	node: JobPost;
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor'];
};

export type PageInfo = {
	__typename?: 'PageInfo';
	/** true if paging forward and there are more records. */
	hasNextPage?: Maybe<Scalars['Boolean']>;
	/** true if paging backwards and there are more records. */
	hasPreviousPage?: Maybe<Scalars['Boolean']>;
	/** The cursor of the first returned record. */
	startCursor?: Maybe<Scalars['ConnectionCursor']>;
	/** The cursor of the last returned record. */
	endCursor?: Maybe<Scalars['ConnectionCursor']>;
};

export type JobPostConnection = {
	__typename?: 'JobPostConnection';
	/** Paging information */
	pageInfo: PageInfo;
	/** Array of edges. */
	edges: Array<JobPostEdge>;
	/** Fetch total count of records */
	totalCount: Scalars['Int'];
};

export type JobPostCountAggregate = {
	__typename?: 'JobPostCountAggregate';
	isActive?: Maybe<Scalars['Int']>;
	isArchived?: Maybe<Scalars['Int']>;
	id?: Maybe<Scalars['Int']>;
};

export type JobPostMinAggregate = {
	__typename?: 'JobPostMinAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type JobPostMaxAggregate = {
	__typename?: 'JobPostMaxAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type JobPostAggregateResponse = {
	__typename?: 'JobPostAggregateResponse';
	count?: Maybe<JobPostCountAggregate>;
	min?: Maybe<JobPostMinAggregate>;
	max?: Maybe<JobPostMaxAggregate>;
};

export type UpworkJobsSearchCriterionDeleteResponse = {
	__typename?: 'UpworkJobsSearchCriterionDeleteResponse';
	id?: Maybe<Scalars['ID']>;
	employeeId?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	categoryId?: Maybe<Scalars['String']>;
	occupation?: Maybe<Scalars['String']>;
	occupationId?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	keyword?: Maybe<Scalars['String']>;
};

export type UpworkJobsSearchCriterionEdge = {
	__typename?: 'UpworkJobsSearchCriterionEdge';
	/** The node containing the UpworkJobsSearchCriterion */
	node: UpworkJobsSearchCriterion;
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor'];
};

export type UpworkJobsSearchCriterionConnection = {
	__typename?: 'UpworkJobsSearchCriterionConnection';
	/** Paging information */
	pageInfo: PageInfo;
	/** Array of edges. */
	edges: Array<UpworkJobsSearchCriterionEdge>;
	/** Fetch total count of records */
	totalCount: Scalars['Int'];
};

export type UpworkJobsSearchCriterionCountAggregate = {
	__typename?: 'UpworkJobsSearchCriterionCountAggregate';
	isActive?: Maybe<Scalars['Int']>;
	isArchived?: Maybe<Scalars['Int']>;
	id?: Maybe<Scalars['Int']>;
};

export type UpworkJobsSearchCriterionMinAggregate = {
	__typename?: 'UpworkJobsSearchCriterionMinAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type UpworkJobsSearchCriterionMaxAggregate = {
	__typename?: 'UpworkJobsSearchCriterionMaxAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type UpworkJobsSearchCriterionAggregateResponse = {
	__typename?: 'UpworkJobsSearchCriterionAggregateResponse';
	count?: Maybe<UpworkJobsSearchCriterionCountAggregate>;
	min?: Maybe<UpworkJobsSearchCriterionMinAggregate>;
	max?: Maybe<UpworkJobsSearchCriterionMaxAggregate>;
};

export type EmployeeDeleteResponse = {
	__typename?: 'EmployeeDeleteResponse';
	id?: Maybe<Scalars['ID']>;
	externalEmployeeId?: Maybe<Scalars['String']>;
	firstName?: Maybe<Scalars['String']>;
	lastName?: Maybe<Scalars['String']>;
	name?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
};

export type EmployeeEdge = {
	__typename?: 'EmployeeEdge';
	/** The node containing the Employee */
	node: Employee;
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor'];
};

export type EmployeeConnection = {
	__typename?: 'EmployeeConnection';
	/** Paging information */
	pageInfo: PageInfo;
	/** Array of edges. */
	edges: Array<EmployeeEdge>;
	/** Fetch total count of records */
	totalCount: Scalars['Int'];
};

export type EmployeeCountAggregate = {
	__typename?: 'EmployeeCountAggregate';
	isActive?: Maybe<Scalars['Int']>;
	isArchived?: Maybe<Scalars['Int']>;
	id?: Maybe<Scalars['Int']>;
	externalEmployeeId?: Maybe<Scalars['Int']>;
};

export type EmployeeMinAggregate = {
	__typename?: 'EmployeeMinAggregate';
	id?: Maybe<Scalars['ID']>;
	externalEmployeeId?: Maybe<Scalars['String']>;
};

export type EmployeeMaxAggregate = {
	__typename?: 'EmployeeMaxAggregate';
	id?: Maybe<Scalars['ID']>;
	externalEmployeeId?: Maybe<Scalars['String']>;
};

export type EmployeeAggregateResponse = {
	__typename?: 'EmployeeAggregateResponse';
	count?: Maybe<EmployeeCountAggregate>;
	min?: Maybe<EmployeeMinAggregate>;
	max?: Maybe<EmployeeMaxAggregate>;
};

export type EmployeeUpworkJobSearchCriteriaCountAggregate = {
	__typename?: 'EmployeeUpworkJobSearchCriteriaCountAggregate';
	isActive?: Maybe<Scalars['Int']>;
	isArchived?: Maybe<Scalars['Int']>;
	id?: Maybe<Scalars['Int']>;
};

export type EmployeeUpworkJobSearchCriteriaMinAggregate = {
	__typename?: 'EmployeeUpworkJobSearchCriteriaMinAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type EmployeeUpworkJobSearchCriteriaMaxAggregate = {
	__typename?: 'EmployeeUpworkJobSearchCriteriaMaxAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type EmployeeUpworkJobSearchCriteriaAggregateResponse = {
	__typename?: 'EmployeeUpworkJobSearchCriteriaAggregateResponse';
	count?: Maybe<EmployeeUpworkJobSearchCriteriaCountAggregate>;
	min?: Maybe<EmployeeUpworkJobSearchCriteriaMinAggregate>;
	max?: Maybe<EmployeeUpworkJobSearchCriteriaMaxAggregate>;
};

export type EmployeeJobPostDeleteResponse = {
	__typename?: 'EmployeeJobPostDeleteResponse';
	id?: Maybe<Scalars['ID']>;
	employeeId?: Maybe<Scalars['String']>;
	jobPostId?: Maybe<Scalars['String']>;
	isApplied?: Maybe<Scalars['Boolean']>;
	appliedDate?: Maybe<Scalars['DateTime']>;
};

export type EmployeeJobPostEdge = {
	__typename?: 'EmployeeJobPostEdge';
	/** The node containing the EmployeeJobPost */
	node: EmployeeJobPost;
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor'];
};

export type EmployeeJobPostConnection = {
	__typename?: 'EmployeeJobPostConnection';
	/** Paging information */
	pageInfo: PageInfo;
	/** Array of edges. */
	edges: Array<EmployeeJobPostEdge>;
	/** Fetch total count of records */
	totalCount: Scalars['Int'];
};

export type EmployeeJobPostCountAggregate = {
	__typename?: 'EmployeeJobPostCountAggregate';
	isActive?: Maybe<Scalars['Int']>;
	isArchived?: Maybe<Scalars['Int']>;
	id?: Maybe<Scalars['Int']>;
	isApplied?: Maybe<Scalars['Int']>;
};

export type EmployeeJobPostMinAggregate = {
	__typename?: 'EmployeeJobPostMinAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type EmployeeJobPostMaxAggregate = {
	__typename?: 'EmployeeJobPostMaxAggregate';
	id?: Maybe<Scalars['ID']>;
};

export type EmployeeJobPostAggregateResponse = {
	__typename?: 'EmployeeJobPostAggregateResponse';
	count?: Maybe<EmployeeJobPostCountAggregate>;
	min?: Maybe<EmployeeJobPostMinAggregate>;
	max?: Maybe<EmployeeJobPostMaxAggregate>;
};

export type Query = {
	__typename?: 'Query';
	jobPost?: Maybe<JobPost>;
	jobPosts: JobPostConnection;
	jobPostAggregate: JobPostAggregateResponse;
	upworkJobsSearchCriterion?: Maybe<UpworkJobsSearchCriterion>;
	upworkJobsSearchCriteria: UpworkJobsSearchCriterionConnection;
	upworkJobsSearchCriterionAggregate: UpworkJobsSearchCriterionAggregateResponse;
	employee?: Maybe<Employee>;
	employees: EmployeeConnection;
	employeeAggregate: EmployeeAggregateResponse;
	employeeJobPost?: Maybe<EmployeeJobPost>;
	employeeJobPosts: EmployeeJobPostConnection;
	employeeJobPostAggregate: EmployeeJobPostAggregateResponse;
};

export type QueryJobPostArgs = {
	id: Scalars['ID'];
};

export type QueryJobPostsArgs = {
	paging?: Maybe<CursorPaging>;
	filter?: Maybe<JobPostFilter>;
	sorting?: Maybe<Array<JobPostSort>>;
};

export type QueryJobPostAggregateArgs = {
	filter?: Maybe<JobPostAggregateFilter>;
};

export type QueryUpworkJobsSearchCriterionArgs = {
	id: Scalars['ID'];
};

export type QueryUpworkJobsSearchCriteriaArgs = {
	paging?: Maybe<CursorPaging>;
	filter?: Maybe<UpworkJobsSearchCriterionFilter>;
	sorting?: Maybe<Array<UpworkJobsSearchCriterionSort>>;
};

export type QueryUpworkJobsSearchCriterionAggregateArgs = {
	filter?: Maybe<UpworkJobsSearchCriterionAggregateFilter>;
};

export type QueryEmployeeArgs = {
	id: Scalars['ID'];
};

export type QueryEmployeesArgs = {
	paging?: Maybe<CursorPaging>;
	filter?: Maybe<EmployeeFilter>;
	sorting?: Maybe<Array<EmployeeSort>>;
};

export type QueryEmployeeAggregateArgs = {
	filter?: Maybe<EmployeeAggregateFilter>;
};

export type QueryEmployeeJobPostArgs = {
	id: Scalars['ID'];
};

export type QueryEmployeeJobPostsArgs = {
	paging?: Maybe<CursorPaging>;
	filter?: Maybe<EmployeeJobPostFilter>;
	sorting?: Maybe<Array<EmployeeJobPostSort>>;
};

export type QueryEmployeeJobPostAggregateArgs = {
	filter?: Maybe<EmployeeJobPostAggregateFilter>;
};

export type CursorPaging = {
	/** Paginate before opaque cursor */
	before?: Maybe<Scalars['ConnectionCursor']>;
	/** Paginate after opaque cursor */
	after?: Maybe<Scalars['ConnectionCursor']>;
	/** Paginate first */
	first?: Maybe<Scalars['Int']>;
	/** Paginate last */
	last?: Maybe<Scalars['Int']>;
};

export type JobPostFilter = {
	and?: Maybe<Array<JobPostFilter>>;
	or?: Maybe<Array<JobPostFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type JobPostSort = {
	field: JobPostSortFields;
	direction: SortDirection;
	nulls?: Maybe<SortNulls>;
};

export enum JobPostSortFields {
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	Id = 'id'
}

export type JobPostAggregateFilter = {
	and?: Maybe<Array<JobPostAggregateFilter>>;
	or?: Maybe<Array<JobPostAggregateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type EmployeeFilter = {
	and?: Maybe<Array<EmployeeFilter>>;
	or?: Maybe<Array<EmployeeFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	externalEmployeeId?: Maybe<StringFieldComparison>;
};

export type StringFieldComparison = {
	is?: Maybe<Scalars['Boolean']>;
	isNot?: Maybe<Scalars['Boolean']>;
	eq?: Maybe<Scalars['String']>;
	neq?: Maybe<Scalars['String']>;
	gt?: Maybe<Scalars['String']>;
	gte?: Maybe<Scalars['String']>;
	lt?: Maybe<Scalars['String']>;
	lte?: Maybe<Scalars['String']>;
	like?: Maybe<Scalars['String']>;
	notLike?: Maybe<Scalars['String']>;
	iLike?: Maybe<Scalars['String']>;
	notILike?: Maybe<Scalars['String']>;
	in?: Maybe<Array<Scalars['String']>>;
	notIn?: Maybe<Array<Scalars['String']>>;
};

export type EmployeeSort = {
	field: EmployeeSortFields;
	direction: SortDirection;
	nulls?: Maybe<SortNulls>;
};

export enum EmployeeSortFields {
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	Id = 'id',
	ExternalEmployeeId = 'externalEmployeeId'
}

export type EmployeeAggregateFilter = {
	and?: Maybe<Array<EmployeeAggregateFilter>>;
	or?: Maybe<Array<EmployeeAggregateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	externalEmployeeId?: Maybe<StringFieldComparison>;
};

export type EmployeeJobPostFilter = {
	and?: Maybe<Array<EmployeeJobPostFilter>>;
	or?: Maybe<Array<EmployeeJobPostFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	isApplied?: Maybe<BooleanFieldComparison>;
};

export type EmployeeJobPostSort = {
	field: EmployeeJobPostSortFields;
	direction: SortDirection;
	nulls?: Maybe<SortNulls>;
};

export enum EmployeeJobPostSortFields {
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	Id = 'id',
	IsApplied = 'isApplied'
}

export type EmployeeJobPostAggregateFilter = {
	and?: Maybe<Array<EmployeeJobPostAggregateFilter>>;
	or?: Maybe<Array<EmployeeJobPostAggregateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	isApplied?: Maybe<BooleanFieldComparison>;
};

export type Mutation = {
	__typename?: 'Mutation';
	deleteOneJobPost: JobPostDeleteResponse;
	deleteManyJobPosts: DeleteManyResponse;
	updateOneJobPost: JobPost;
	updateManyJobPosts: UpdateManyResponse;
	createOneJobPost: JobPost;
	createManyJobPosts: Array<JobPost>;
	deleteOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterionDeleteResponse;
	deleteManyUpworkJobsSearchCriteria: DeleteManyResponse;
	updateOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	updateManyUpworkJobsSearchCriteria: UpdateManyResponse;
	createOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	createManyUpworkJobsSearchCriteria: Array<UpworkJobsSearchCriterion>;
	removeEmployeeFromUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	setEmployeeOnUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	deleteOneEmployee: EmployeeDeleteResponse;
	deleteManyEmployees: DeleteManyResponse;
	updateOneEmployee: Employee;
	updateManyEmployees: UpdateManyResponse;
	createOneEmployee: Employee;
	createManyEmployees: Array<Employee>;
	removeUpworkJobSearchCriteriaFromEmployee: Employee;
	addUpworkJobSearchCriteriaToEmployee: Employee;
	deleteOneEmployeeJobPost: EmployeeJobPostDeleteResponse;
	deleteManyEmployeeJobPosts: DeleteManyResponse;
	updateOneEmployeeJobPost: EmployeeJobPost;
	updateManyEmployeeJobPosts: UpdateManyResponse;
	createOneEmployeeJobPost: EmployeeJobPost;
	createManyEmployeeJobPosts: Array<EmployeeJobPost>;
	removeJobPostFromEmployeeJobPost: EmployeeJobPost;
	removeEmployeeFromEmployeeJobPost: EmployeeJobPost;
	setJobPostOnEmployeeJobPost: EmployeeJobPost;
	setEmployeeOnEmployeeJobPost: EmployeeJobPost;
};

export type MutationDeleteOneJobPostArgs = {
	input: DeleteOneInput;
};

export type MutationDeleteManyJobPostsArgs = {
	input: DeleteManyJobPostsInput;
};

export type MutationUpdateOneJobPostArgs = {
	input: UpdateOneJobPostInput;
};

export type MutationUpdateManyJobPostsArgs = {
	input: UpdateManyJobPostsInput;
};

export type MutationCreateOneJobPostArgs = {
	input: CreateOneJobPostInput;
};

export type MutationCreateManyJobPostsArgs = {
	input: CreateManyJobPostsInput;
};

export type MutationDeleteOneUpworkJobsSearchCriterionArgs = {
	input: DeleteOneInput;
};

export type MutationDeleteManyUpworkJobsSearchCriteriaArgs = {
	input: DeleteManyUpworkJobsSearchCriteriaInput;
};

export type MutationUpdateOneUpworkJobsSearchCriterionArgs = {
	input: UpdateOneUpworkJobsSearchCriterionInput;
};

export type MutationUpdateManyUpworkJobsSearchCriteriaArgs = {
	input: UpdateManyUpworkJobsSearchCriteriaInput;
};

export type MutationCreateOneUpworkJobsSearchCriterionArgs = {
	input: CreateOneUpworkJobsSearchCriterionInput;
};

export type MutationCreateManyUpworkJobsSearchCriteriaArgs = {
	input: CreateManyUpworkJobsSearchCriteriaInput;
};

export type MutationRemoveEmployeeFromUpworkJobsSearchCriterionArgs = {
	input: RelationInput;
};

export type MutationSetEmployeeOnUpworkJobsSearchCriterionArgs = {
	input: RelationInput;
};

export type MutationDeleteOneEmployeeArgs = {
	input: DeleteOneInput;
};

export type MutationDeleteManyEmployeesArgs = {
	input: DeleteManyEmployeesInput;
};

export type MutationUpdateOneEmployeeArgs = {
	input: UpdateOneEmployeeInput;
};

export type MutationUpdateManyEmployeesArgs = {
	input: UpdateManyEmployeesInput;
};

export type MutationCreateOneEmployeeArgs = {
	input: CreateOneEmployeeInput;
};

export type MutationCreateManyEmployeesArgs = {
	input: CreateManyEmployeesInput;
};

export type MutationRemoveUpworkJobSearchCriteriaFromEmployeeArgs = {
	input: RelationsInput;
};

export type MutationAddUpworkJobSearchCriteriaToEmployeeArgs = {
	input: RelationsInput;
};

export type MutationDeleteOneEmployeeJobPostArgs = {
	input: DeleteOneInput;
};

export type MutationDeleteManyEmployeeJobPostsArgs = {
	input: DeleteManyEmployeeJobPostsInput;
};

export type MutationUpdateOneEmployeeJobPostArgs = {
	input: UpdateOneEmployeeJobPostInput;
};

export type MutationUpdateManyEmployeeJobPostsArgs = {
	input: UpdateManyEmployeeJobPostsInput;
};

export type MutationCreateOneEmployeeJobPostArgs = {
	input: CreateOneEmployeeJobPostInput;
};

export type MutationCreateManyEmployeeJobPostsArgs = {
	input: CreateManyEmployeeJobPostsInput;
};

export type MutationRemoveJobPostFromEmployeeJobPostArgs = {
	input: RelationInput;
};

export type MutationRemoveEmployeeFromEmployeeJobPostArgs = {
	input: RelationInput;
};

export type MutationSetJobPostOnEmployeeJobPostArgs = {
	input: RelationInput;
};

export type MutationSetEmployeeOnEmployeeJobPostArgs = {
	input: RelationInput;
};

export type DeleteOneInput = {
	/** The id of the record to delete. */
	id: Scalars['ID'];
};

export type DeleteManyJobPostsInput = {
	/** Filter to find records to delete */
	filter: JobPostDeleteFilter;
};

export type JobPostDeleteFilter = {
	and?: Maybe<Array<JobPostDeleteFilter>>;
	or?: Maybe<Array<JobPostDeleteFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type UpdateOneJobPostInput = {
	/** The id of the record to update */
	id: Scalars['ID'];
	/** The update to apply. */
	update: UpdateJobPost;
};

export type UpdateJobPost = {
	id?: Maybe<Scalars['ID']>;
	providerCode?: Maybe<Scalars['String']>;
	providerJobId?: Maybe<Scalars['String']>;
	title?: Maybe<Scalars['String']>;
	description?: Maybe<Scalars['String']>;
	jobDateCreated?: Maybe<Scalars['DateTime']>;
	jobStatus?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	url?: Maybe<Scalars['String']>;
	budget?: Maybe<Scalars['String']>;
	duration?: Maybe<Scalars['String']>;
	workload?: Maybe<Scalars['String']>;
	skills?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	subcategory?: Maybe<Scalars['String']>;
	country?: Maybe<Scalars['String']>;
	clientFeedback?: Maybe<Scalars['String']>;
	clientReviewsCount?: Maybe<Scalars['Float']>;
	clientJobsPosted?: Maybe<Scalars['Float']>;
	clientPastHires?: Maybe<Scalars['Float']>;
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']>;
	searchCategory?: Maybe<Scalars['String']>;
	searchCategoryId?: Maybe<Scalars['String']>;
	searchOccupation?: Maybe<Scalars['String']>;
	searchOccupationId?: Maybe<Scalars['String']>;
	searchJobType?: Maybe<Scalars['String']>;
	searchKeyword?: Maybe<Scalars['String']>;
};

export type UpdateManyJobPostsInput = {
	/** Filter used to find fields to update */
	filter: JobPostUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateJobPost;
};

export type JobPostUpdateFilter = {
	and?: Maybe<Array<JobPostUpdateFilter>>;
	or?: Maybe<Array<JobPostUpdateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type CreateOneJobPostInput = {
	/** The record to create */
	jobPost: CreateJobPost;
};

export type CreateJobPost = {
	id?: Maybe<Scalars['ID']>;
	providerCode?: Maybe<Scalars['String']>;
	providerJobId?: Maybe<Scalars['String']>;
	title?: Maybe<Scalars['String']>;
	description?: Maybe<Scalars['String']>;
	jobDateCreated?: Maybe<Scalars['DateTime']>;
	jobStatus?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	url?: Maybe<Scalars['String']>;
	budget?: Maybe<Scalars['String']>;
	duration?: Maybe<Scalars['String']>;
	workload?: Maybe<Scalars['String']>;
	skills?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	subcategory?: Maybe<Scalars['String']>;
	country?: Maybe<Scalars['String']>;
	clientFeedback?: Maybe<Scalars['String']>;
	clientReviewsCount?: Maybe<Scalars['Float']>;
	clientJobsPosted?: Maybe<Scalars['Float']>;
	clientPastHires?: Maybe<Scalars['Float']>;
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']>;
	searchCategory?: Maybe<Scalars['String']>;
	searchCategoryId?: Maybe<Scalars['String']>;
	searchOccupation?: Maybe<Scalars['String']>;
	searchOccupationId?: Maybe<Scalars['String']>;
	searchJobType?: Maybe<Scalars['String']>;
	searchKeyword?: Maybe<Scalars['String']>;
};

export type CreateManyJobPostsInput = {
	/** Array of records to create */
	jobPosts: Array<CreateJobPost>;
};

export type DeleteManyUpworkJobsSearchCriteriaInput = {
	/** Filter to find records to delete */
	filter: UpworkJobsSearchCriterionDeleteFilter;
};

export type UpworkJobsSearchCriterionDeleteFilter = {
	and?: Maybe<Array<UpworkJobsSearchCriterionDeleteFilter>>;
	or?: Maybe<Array<UpworkJobsSearchCriterionDeleteFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type UpdateOneUpworkJobsSearchCriterionInput = {
	/** The id of the record to update */
	id: Scalars['ID'];
	/** The update to apply. */
	update: UpdateUpworkJobsSearchCriterion;
};

export type UpdateUpworkJobsSearchCriterion = {
	id?: Maybe<Scalars['ID']>;
	employeeId?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	categoryId?: Maybe<Scalars['String']>;
	occupation?: Maybe<Scalars['String']>;
	occupationId?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	keyword?: Maybe<Scalars['String']>;
};

export type UpdateManyUpworkJobsSearchCriteriaInput = {
	/** Filter used to find fields to update */
	filter: UpworkJobsSearchCriterionUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateUpworkJobsSearchCriterion;
};

export type UpworkJobsSearchCriterionUpdateFilter = {
	and?: Maybe<Array<UpworkJobsSearchCriterionUpdateFilter>>;
	or?: Maybe<Array<UpworkJobsSearchCriterionUpdateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type CreateOneUpworkJobsSearchCriterionInput = {
	/** The record to create */
	upworkJobsSearchCriterion: CreateUpworkJobsSearchCriterion;
};

export type CreateUpworkJobsSearchCriterion = {
	id?: Maybe<Scalars['ID']>;
	employeeId?: Maybe<Scalars['String']>;
	category?: Maybe<Scalars['String']>;
	categoryId?: Maybe<Scalars['String']>;
	occupation?: Maybe<Scalars['String']>;
	occupationId?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
	keyword?: Maybe<Scalars['String']>;
};

export type CreateManyUpworkJobsSearchCriteriaInput = {
	/** Array of records to create */
	upworkJobsSearchCriteria: Array<CreateUpworkJobsSearchCriterion>;
};

export type RelationInput = {
	/** The id of the record. */
	id: Scalars['ID'];
	/** The id of relation. */
	relationId: Scalars['ID'];
};

export type DeleteManyEmployeesInput = {
	/** Filter to find records to delete */
	filter: EmployeeDeleteFilter;
};

export type EmployeeDeleteFilter = {
	and?: Maybe<Array<EmployeeDeleteFilter>>;
	or?: Maybe<Array<EmployeeDeleteFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	externalEmployeeId?: Maybe<StringFieldComparison>;
};

export type UpdateOneEmployeeInput = {
	/** The id of the record to update */
	id: Scalars['ID'];
	/** The update to apply. */
	update: UpdateEmployee;
};

export type UpdateEmployee = {
	id?: Maybe<Scalars['ID']>;
	externalEmployeeId?: Maybe<Scalars['String']>;
	firstName?: Maybe<Scalars['String']>;
	lastName?: Maybe<Scalars['String']>;
	name?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
};

export type UpdateManyEmployeesInput = {
	/** Filter used to find fields to update */
	filter: EmployeeUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateEmployee;
};

export type EmployeeUpdateFilter = {
	and?: Maybe<Array<EmployeeUpdateFilter>>;
	or?: Maybe<Array<EmployeeUpdateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	externalEmployeeId?: Maybe<StringFieldComparison>;
};

export type CreateOneEmployeeInput = {
	/** The record to create */
	employee: CreateEmployee;
};

export type CreateEmployee = {
	id?: Maybe<Scalars['ID']>;
	externalEmployeeId?: Maybe<Scalars['String']>;
	firstName?: Maybe<Scalars['String']>;
	lastName?: Maybe<Scalars['String']>;
	name?: Maybe<Scalars['String']>;
	jobType?: Maybe<Scalars['String']>;
};

export type CreateManyEmployeesInput = {
	/** Array of records to create */
	employees: Array<CreateEmployee>;
};

export type RelationsInput = {
	/** The id of the record. */
	id: Scalars['ID'];
	/** The ids of the relations. */
	relationIds: Array<Scalars['ID']>;
};

export type DeleteManyEmployeeJobPostsInput = {
	/** Filter to find records to delete */
	filter: EmployeeJobPostDeleteFilter;
};

export type EmployeeJobPostDeleteFilter = {
	and?: Maybe<Array<EmployeeJobPostDeleteFilter>>;
	or?: Maybe<Array<EmployeeJobPostDeleteFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	isApplied?: Maybe<BooleanFieldComparison>;
};

export type UpdateOneEmployeeJobPostInput = {
	/** The id of the record to update */
	id: Scalars['ID'];
	/** The update to apply. */
	update: UpdateEmployeeJobPost;
};

export type UpdateEmployeeJobPost = {
	id?: Maybe<Scalars['ID']>;
	employeeId?: Maybe<Scalars['String']>;
	jobPostId?: Maybe<Scalars['String']>;
	isApplied?: Maybe<Scalars['Boolean']>;
	appliedDate?: Maybe<Scalars['DateTime']>;
};

export type UpdateManyEmployeeJobPostsInput = {
	/** Filter used to find fields to update */
	filter: EmployeeJobPostUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateEmployeeJobPost;
};

export type EmployeeJobPostUpdateFilter = {
	and?: Maybe<Array<EmployeeJobPostUpdateFilter>>;
	or?: Maybe<Array<EmployeeJobPostUpdateFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	isApplied?: Maybe<BooleanFieldComparison>;
};

export type CreateOneEmployeeJobPostInput = {
	/** The record to create */
	employeeJobPost: CreateEmployeeJobPost;
};

export type CreateEmployeeJobPost = {
	id?: Maybe<Scalars['ID']>;
	employeeId?: Maybe<Scalars['String']>;
	jobPostId?: Maybe<Scalars['String']>;
	isApplied?: Maybe<Scalars['Boolean']>;
	appliedDate?: Maybe<Scalars['DateTime']>;
};

export type CreateManyEmployeeJobPostsInput = {
	/** Array of records to create */
	employeeJobPosts: Array<CreateEmployeeJobPost>;
};

export type Subscription = {
	__typename?: 'Subscription';
	deletedOneJobPost: JobPostDeleteResponse;
	deletedManyJobPosts: DeleteManyResponse;
	updatedOneJobPost: JobPost;
	updatedManyJobPosts: UpdateManyResponse;
	createdJobPost: JobPost;
	deletedOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterionDeleteResponse;
	deletedManyUpworkJobsSearchCriteria: DeleteManyResponse;
	updatedOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	updatedManyUpworkJobsSearchCriteria: UpdateManyResponse;
	createdUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	deletedOneEmployee: EmployeeDeleteResponse;
	deletedManyEmployees: DeleteManyResponse;
	updatedOneEmployee: Employee;
	updatedManyEmployees: UpdateManyResponse;
	createdEmployee: Employee;
	deletedOneEmployeeJobPost: EmployeeJobPostDeleteResponse;
	deletedManyEmployeeJobPosts: DeleteManyResponse;
	updatedOneEmployeeJobPost: EmployeeJobPost;
	updatedManyEmployeeJobPosts: UpdateManyResponse;
	createdEmployeeJobPost: EmployeeJobPost;
};

export type SubscriptionDeletedOneJobPostArgs = {
	input?: Maybe<DeleteOneJobPostSubscriptionFilterInput>;
};

export type SubscriptionUpdatedOneJobPostArgs = {
	input?: Maybe<UpdateOneJobPostSubscriptionFilterInput>;
};

export type SubscriptionCreatedJobPostArgs = {
	input?: Maybe<CreateJobPostSubscriptionFilterInput>;
};

export type SubscriptionDeletedOneUpworkJobsSearchCriterionArgs = {
	input?: Maybe<DeleteOneUpworkJobsSearchCriterionSubscriptionFilterInput>;
};

export type SubscriptionUpdatedOneUpworkJobsSearchCriterionArgs = {
	input?: Maybe<UpdateOneUpworkJobsSearchCriterionSubscriptionFilterInput>;
};

export type SubscriptionCreatedUpworkJobsSearchCriterionArgs = {
	input?: Maybe<CreateUpworkJobsSearchCriterionSubscriptionFilterInput>;
};

export type SubscriptionDeletedOneEmployeeArgs = {
	input?: Maybe<DeleteOneEmployeeSubscriptionFilterInput>;
};

export type SubscriptionUpdatedOneEmployeeArgs = {
	input?: Maybe<UpdateOneEmployeeSubscriptionFilterInput>;
};

export type SubscriptionCreatedEmployeeArgs = {
	input?: Maybe<CreateEmployeeSubscriptionFilterInput>;
};

export type SubscriptionDeletedOneEmployeeJobPostArgs = {
	input?: Maybe<DeleteOneEmployeeJobPostSubscriptionFilterInput>;
};

export type SubscriptionUpdatedOneEmployeeJobPostArgs = {
	input?: Maybe<UpdateOneEmployeeJobPostSubscriptionFilterInput>;
};

export type SubscriptionCreatedEmployeeJobPostArgs = {
	input?: Maybe<CreateEmployeeJobPostSubscriptionFilterInput>;
};

export type DeleteOneJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: JobPostSubscriptionFilter;
};

export type JobPostSubscriptionFilter = {
	and?: Maybe<Array<JobPostSubscriptionFilter>>;
	or?: Maybe<Array<JobPostSubscriptionFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type UpdateOneJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: JobPostSubscriptionFilter;
};

export type CreateJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: JobPostSubscriptionFilter;
};

export type DeleteOneUpworkJobsSearchCriterionSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UpworkJobsSearchCriterionSubscriptionFilter;
};

export type UpworkJobsSearchCriterionSubscriptionFilter = {
	and?: Maybe<Array<UpworkJobsSearchCriterionSubscriptionFilter>>;
	or?: Maybe<Array<UpworkJobsSearchCriterionSubscriptionFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
};

export type UpdateOneUpworkJobsSearchCriterionSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UpworkJobsSearchCriterionSubscriptionFilter;
};

export type CreateUpworkJobsSearchCriterionSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UpworkJobsSearchCriterionSubscriptionFilter;
};

export type DeleteOneEmployeeSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeSubscriptionFilter;
};

export type EmployeeSubscriptionFilter = {
	and?: Maybe<Array<EmployeeSubscriptionFilter>>;
	or?: Maybe<Array<EmployeeSubscriptionFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	externalEmployeeId?: Maybe<StringFieldComparison>;
};

export type UpdateOneEmployeeSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeSubscriptionFilter;
};

export type CreateEmployeeSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeSubscriptionFilter;
};

export type DeleteOneEmployeeJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobPostSubscriptionFilter;
};

export type EmployeeJobPostSubscriptionFilter = {
	and?: Maybe<Array<EmployeeJobPostSubscriptionFilter>>;
	or?: Maybe<Array<EmployeeJobPostSubscriptionFilter>>;
	isActive?: Maybe<BooleanFieldComparison>;
	isArchived?: Maybe<BooleanFieldComparison>;
	id?: Maybe<IdFilterComparison>;
	isApplied?: Maybe<BooleanFieldComparison>;
};

export type UpdateOneEmployeeJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobPostSubscriptionFilter;
};

export type CreateEmployeeJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobPostSubscriptionFilter;
};

export type EmployeeJobPostsQueryVariables = Exact<{ [key: string]: never }>;

export type EmployeeJobPostsQuery = { __typename?: 'Query' } & {
	employeeJobPosts: { __typename?: 'EmployeeJobPostConnection' } & {
		edges: Array<
			{ __typename?: 'EmployeeJobPostEdge' } & {
				node: { __typename?: 'EmployeeJobPost' } & Pick<
					EmployeeJobPost,
					'id' | 'isApplied' | 'appliedDate'
				> & {
						employee: { __typename?: 'Employee' } & Pick<
							Employee,
							'externalEmployeeId'
						>;
						jobPost: { __typename?: 'JobPost' } & Pick<
							JobPost,
							| 'id'
							| 'providerCode'
							| 'providerJobId'
							| 'title'
							| 'description'
							| 'jobDateCreated'
							| 'jobStatus'
							| 'jobType'
							| 'url'
							| 'budget'
							| 'duration'
							| 'workload'
							| 'skills'
							| 'category'
							| 'subcategory'
							| 'country'
							| 'clientFeedback'
							| 'clientReviewsCount'
							| 'clientJobsPosted'
							| 'clientPastHires'
							| 'clientPaymentVerificationStatus'
						>;
					};
			}
		>;
	};
};

export type EmployeeQueryVariables = Exact<{ [key: string]: never }>;

export type EmployeeQuery = { __typename?: 'Query' } & {
	employees: { __typename?: 'EmployeeConnection' } & {
		edges: Array<
			{ __typename?: 'EmployeeEdge' } & {
				node: { __typename?: 'Employee' } & Pick<
					Employee,
					'id' | 'externalEmployeeId' | 'firstName' | 'lastName'
				>;
			}
		>;
	};
};

export const EmployeeJobPostsDocument: DocumentNode<
	EmployeeJobPostsQuery,
	EmployeeJobPostsQueryVariables
> = {
	kind: 'Document',
	definitions: [
		{
			kind: 'OperationDefinition',
			operation: 'query',
			name: { kind: 'Name', value: 'employeeJobPosts' },
			variableDefinitions: [],
			directives: [],
			selectionSet: {
				kind: 'SelectionSet',
				selections: [
					{
						kind: 'Field',
						name: { kind: 'Name', value: 'employeeJobPosts' },
						arguments: [],
						directives: [],
						selectionSet: {
							kind: 'SelectionSet',
							selections: [
								{
									kind: 'Field',
									name: { kind: 'Name', value: 'edges' },
									arguments: [],
									directives: [],
									selectionSet: {
										kind: 'SelectionSet',
										selections: [
											{
												kind: 'Field',
												name: {
													kind: 'Name',
													value: 'node'
												},
												arguments: [],
												directives: [],
												selectionSet: {
													kind: 'SelectionSet',
													selections: [
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value: 'id'
															},
															arguments: [],
															directives: []
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value:
																	'isApplied'
															},
															arguments: [],
															directives: []
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value:
																	'appliedDate'
															},
															arguments: [],
															directives: []
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value:
																	'employee'
															},
															arguments: [],
															directives: [],
															selectionSet: {
																kind:
																	'SelectionSet',
																selections: [
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'externalEmployeeId'
																		},
																		arguments: [],
																		directives: []
																	}
																]
															}
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value: 'jobPost'
															},
															arguments: [],
															directives: [],
															selectionSet: {
																kind:
																	'SelectionSet',
																selections: [
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'id'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'providerCode'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'providerJobId'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'title'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'description'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'jobDateCreated'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'jobStatus'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'jobType'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'url'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'budget'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'duration'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'workload'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'skills'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'category'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'subcategory'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'country'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'clientFeedback'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'clientReviewsCount'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'clientJobsPosted'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'clientPastHires'
																		},
																		arguments: [],
																		directives: []
																	},
																	{
																		kind:
																			'Field',
																		name: {
																			kind:
																				'Name',
																			value:
																				'clientPaymentVerificationStatus'
																		},
																		arguments: [],
																		directives: []
																	}
																]
															}
														}
													]
												}
											}
										]
									}
								}
							]
						}
					}
				]
			}
		}
	]
};
export const EmployeeDocument: DocumentNode<
	EmployeeQuery,
	EmployeeQueryVariables
> = {
	kind: 'Document',
	definitions: [
		{
			kind: 'OperationDefinition',
			operation: 'query',
			name: { kind: 'Name', value: 'employee' },
			variableDefinitions: [],
			directives: [],
			selectionSet: {
				kind: 'SelectionSet',
				selections: [
					{
						kind: 'Field',
						name: { kind: 'Name', value: 'employees' },
						arguments: [],
						directives: [],
						selectionSet: {
							kind: 'SelectionSet',
							selections: [
								{
									kind: 'Field',
									name: { kind: 'Name', value: 'edges' },
									arguments: [],
									directives: [],
									selectionSet: {
										kind: 'SelectionSet',
										selections: [
											{
												kind: 'Field',
												name: {
													kind: 'Name',
													value: 'node'
												},
												arguments: [],
												directives: [],
												selectionSet: {
													kind: 'SelectionSet',
													selections: [
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value: 'id'
															},
															arguments: [],
															directives: []
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value:
																	'externalEmployeeId'
															},
															arguments: [],
															directives: []
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value:
																	'firstName'
															},
															arguments: [],
															directives: []
														},
														{
															kind: 'Field',
															name: {
																kind: 'Name',
																value:
																	'lastName'
															},
															arguments: [],
															directives: []
														}
													]
												}
											}
										]
									}
								}
							]
						}
					}
				]
			}
		}
	]
};
