import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
	ID: { input: string; output: string; }
	String: { input: string; output: string; }
	Boolean: { input: boolean; output: boolean; }
	Int: { input: number; output: number; }
	Float: { input: number; output: number; }
	/** Cursor for paging through collections */
	ConnectionCursor: { input: any; output: any; }
	/** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
	DateTime: { input: any; output: any; }
};

export type AutomationTask = {
	__typename?: 'AutomationTask';
	command?: Maybe<Scalars['String']['output']>;
	commandResult?: Maybe<Scalars['String']['output']>;
	commandType: Scalars['String']['output'];
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employee?: Maybe<Employee>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPost?: Maybe<EmployeeJobPost>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	executedByEmployee?: Maybe<Employee>;
	executedByEmployeeId?: Maybe<Scalars['String']['output']>;
	executedDate?: Maybe<Scalars['DateTime']['output']>;
	executionTime?: Maybe<Scalars['Float']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	isBroadcast: Scalars['Boolean']['output'];
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPost?: Maybe<JobPost>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode: Scalars['String']['output'];
	providerJobId?: Maybe<Scalars['String']['output']>;
	status: Scalars['String']['output'];
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type AutomationTaskAggregateFilter = {
	and?: InputMaybe<Array<AutomationTaskAggregateFilter>>;
	commandType?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	executedByEmployeeId?: InputMaybe<StringFieldComparison>;
	executedDate?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isBroadcast?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskAggregateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	status?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type AutomationTaskAggregateGroupBy = {
	__typename?: 'AutomationTaskAggregateGroupBy';
	commandType?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	executedByEmployeeId?: Maybe<Scalars['String']['output']>;
	executedDate?: Maybe<Scalars['DateTime']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	isBroadcast?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	status?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type AutomationTaskAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type AutomationTaskAggregateGroupByExecutedDateArgs = {
	by?: GroupBy;
};


export type AutomationTaskAggregateGroupByJobDateCreatedArgs = {
	by?: GroupBy;
};


export type AutomationTaskAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type AutomationTaskAggregateResponse = {
	__typename?: 'AutomationTaskAggregateResponse';
	count?: Maybe<AutomationTaskCountAggregate>;
	groupBy?: Maybe<AutomationTaskAggregateGroupBy>;
	max?: Maybe<AutomationTaskMaxAggregate>;
	min?: Maybe<AutomationTaskMinAggregate>;
};

export type AutomationTaskConnection = {
	__typename?: 'AutomationTaskConnection';
	/** Array of edges. */
	edges: Array<AutomationTaskEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type AutomationTaskCountAggregate = {
	__typename?: 'AutomationTaskCountAggregate';
	commandType?: Maybe<Scalars['Int']['output']>;
	createdAt?: Maybe<Scalars['Int']['output']>;
	employeeId?: Maybe<Scalars['Int']['output']>;
	employeeJobPostId?: Maybe<Scalars['Int']['output']>;
	executedByEmployeeId?: Maybe<Scalars['Int']['output']>;
	executedDate?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	isBroadcast?: Maybe<Scalars['Int']['output']>;
	jobDateCreated?: Maybe<Scalars['Int']['output']>;
	jobPostId?: Maybe<Scalars['Int']['output']>;
	jobStatus?: Maybe<Scalars['Int']['output']>;
	jobType?: Maybe<Scalars['Int']['output']>;
	providerCode?: Maybe<Scalars['Int']['output']>;
	providerJobId?: Maybe<Scalars['Int']['output']>;
	status?: Maybe<Scalars['Int']['output']>;
	tenantId?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type AutomationTaskDeleteFilter = {
	and?: InputMaybe<Array<AutomationTaskDeleteFilter>>;
	commandType?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	executedByEmployeeId?: InputMaybe<StringFieldComparison>;
	executedDate?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isBroadcast?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskDeleteFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	status?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type AutomationTaskDeleteResponse = {
	__typename?: 'AutomationTaskDeleteResponse';
	command?: Maybe<Scalars['String']['output']>;
	commandResult?: Maybe<Scalars['String']['output']>;
	commandType?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	executedByEmployeeId?: Maybe<Scalars['String']['output']>;
	executedDate?: Maybe<Scalars['DateTime']['output']>;
	executionTime?: Maybe<Scalars['Float']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	isBroadcast?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	status?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type AutomationTaskEdge = {
	__typename?: 'AutomationTaskEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the AutomationTask */
	node: AutomationTask;
};

export type AutomationTaskFilter = {
	and?: InputMaybe<Array<AutomationTaskFilter>>;
	commandType?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employee?: InputMaybe<AutomationTaskFilterEmployeeFilter>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPost?: InputMaybe<AutomationTaskFilterEmployeeJobPostFilter>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	executedByEmployee?: InputMaybe<AutomationTaskFilterEmployeeFilter>;
	executedByEmployeeId?: InputMaybe<StringFieldComparison>;
	executedDate?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isBroadcast?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPost?: InputMaybe<AutomationTaskFilterJobPostFilter>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	status?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type AutomationTaskFilterEmployeeFilter = {
	and?: InputMaybe<Array<AutomationTaskFilterEmployeeFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskFilterEmployeeFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type AutomationTaskFilterEmployeeJobPostFilter = {
	and?: InputMaybe<Array<AutomationTaskFilterEmployeeJobPostFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskFilterEmployeeJobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type AutomationTaskFilterJobPostFilter = {
	and?: InputMaybe<Array<AutomationTaskFilterJobPostFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskFilterJobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type AutomationTaskMaxAggregate = {
	__typename?: 'AutomationTaskMaxAggregate';
	commandType?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	executedByEmployeeId?: Maybe<Scalars['String']['output']>;
	executedDate?: Maybe<Scalars['DateTime']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	status?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type AutomationTaskMinAggregate = {
	__typename?: 'AutomationTaskMinAggregate';
	commandType?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	executedByEmployeeId?: Maybe<Scalars['String']['output']>;
	executedDate?: Maybe<Scalars['DateTime']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	status?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type AutomationTaskSort = {
	direction: SortDirection;
	field: AutomationTaskSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum AutomationTaskSortFields {
	CommandType = 'commandType',
	CreatedAt = 'createdAt',
	EmployeeId = 'employeeId',
	EmployeeJobPostId = 'employeeJobPostId',
	ExecutedByEmployeeId = 'executedByEmployeeId',
	ExecutedDate = 'executedDate',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	IsBroadcast = 'isBroadcast',
	JobDateCreated = 'jobDateCreated',
	JobPostId = 'jobPostId',
	JobStatus = 'jobStatus',
	JobType = 'jobType',
	ProviderCode = 'providerCode',
	ProviderJobId = 'providerJobId',
	Status = 'status',
	TenantId = 'tenantId',
	UpdatedAt = 'updatedAt'
}

export type AutomationTaskSubscriptionFilter = {
	and?: InputMaybe<Array<AutomationTaskSubscriptionFilter>>;
	commandType?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	executedByEmployeeId?: InputMaybe<StringFieldComparison>;
	executedDate?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isBroadcast?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskSubscriptionFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	status?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type AutomationTaskUpdateFilter = {
	and?: InputMaybe<Array<AutomationTaskUpdateFilter>>;
	commandType?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	executedByEmployeeId?: InputMaybe<StringFieldComparison>;
	executedDate?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isBroadcast?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<AutomationTaskUpdateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	status?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type BooleanFieldComparison = {
	is?: InputMaybe<Scalars['Boolean']['input']>;
	isNot?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateAutomationTask = {
	command?: InputMaybe<Scalars['String']['input']>;
	commandResult?: InputMaybe<Scalars['String']['input']>;
	commandType: Scalars['String']['input'];
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId?: InputMaybe<Scalars['String']['input']>;
	employeeJobPostId?: InputMaybe<Scalars['String']['input']>;
	executedByEmployeeId?: InputMaybe<Scalars['String']['input']>;
	executedDate?: InputMaybe<Scalars['DateTime']['input']>;
	executionTime?: InputMaybe<Scalars['Float']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	isBroadcast: Scalars['Boolean']['input'];
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId?: InputMaybe<Scalars['String']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	providerCode: Scalars['String']['input'];
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	status: Scalars['String']['input'];
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateAutomationTaskSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: AutomationTaskSubscriptionFilter;
};

export type CreateEmployee = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	externalEmployeeId?: InputMaybe<Scalars['String']['input']>;
	externalOrgId?: InputMaybe<Scalars['String']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	firstName?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	jobType?: InputMaybe<Scalars['String']['input']>;
	lastName?: InputMaybe<Scalars['String']['input']>;
	linkedInId?: InputMaybe<Scalars['String']['input']>;
	name?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	upworkId?: InputMaybe<Scalars['String']['input']>;
	upworkOrganizationId?: InputMaybe<Scalars['String']['input']>;
	upworkOrganizationName?: InputMaybe<Scalars['String']['input']>;
	userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateEmployeeJobApplication = {
	appliedDate?: InputMaybe<Scalars['DateTime']['input']>;
	appliedStatus?: InputMaybe<Scalars['String']['input']>;
	attachments?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId: Scalars['String']['input'];
	employeeJobPostId: Scalars['String']['input'];
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	isProposalGeneratedByAI?: InputMaybe<Scalars['Boolean']['input']>;
	isViewedByClient?: InputMaybe<Scalars['Boolean']['input']>;
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId: Scalars['String']['input'];
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	proposal?: InputMaybe<Scalars['String']['input']>;
	proposalTemplate?: InputMaybe<Scalars['String']['input']>;
	providerCode: Scalars['String']['input'];
	providerJobApplicationId?: InputMaybe<Scalars['String']['input']>;
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	qa?: InputMaybe<Scalars['String']['input']>;
	rate?: InputMaybe<Scalars['Float']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	terms?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateEmployeeJobApplicationSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobApplicationSubscriptionFilter;
};

export type CreateEmployeeJobPost = {
	appliedDate?: InputMaybe<Scalars['DateTime']['input']>;
	appliedStatus?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId: Scalars['String']['input'];
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isApplied?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived: Scalars['Boolean']['input'];
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId?: InputMaybe<Scalars['String']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	providerCode: Scalars['String']['input'];
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateEmployeeJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobPostSubscriptionFilter;
};

export type CreateEmployeeSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeSubscriptionFilter;
};

export type CreateJobPost = {
	budget?: InputMaybe<Scalars['String']['input']>;
	category?: InputMaybe<Scalars['String']['input']>;
	clientFeedback?: InputMaybe<Scalars['String']['input']>;
	clientJobsPosted?: InputMaybe<Scalars['Float']['input']>;
	clientPastHires?: InputMaybe<Scalars['Float']['input']>;
	clientPaymentVerificationStatus?: InputMaybe<Scalars['Boolean']['input']>;
	clientReviewsCount?: InputMaybe<Scalars['Float']['input']>;
	contractToHire?: InputMaybe<Scalars['Boolean']['input']>;
	country?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	description: Scalars['String']['input'];
	duration?: InputMaybe<Scalars['String']['input']>;
	englishLevel?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	interviewingCount?: InputMaybe<Scalars['Float']['input']>;
	invitesSentCount?: InputMaybe<Scalars['Float']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	languages?: InputMaybe<Scalars['String']['input']>;
	proposalsCount?: InputMaybe<Scalars['Float']['input']>;
	providerCode: Scalars['String']['input'];
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	searchCategory?: InputMaybe<Scalars['String']['input']>;
	searchCategoryId?: InputMaybe<Scalars['String']['input']>;
	searchJobType?: InputMaybe<Scalars['String']['input']>;
	searchKeyword?: InputMaybe<Scalars['String']['input']>;
	searchOccupation?: InputMaybe<Scalars['String']['input']>;
	searchOccupationId?: InputMaybe<Scalars['String']['input']>;
	skills?: InputMaybe<Scalars['String']['input']>;
	subcategory?: InputMaybe<Scalars['String']['input']>;
	title: Scalars['String']['input'];
	unansweredInvitesCount?: InputMaybe<Scalars['Float']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	url?: InputMaybe<Scalars['String']['input']>;
	workload?: InputMaybe<Scalars['String']['input']>;
};

export type CreateJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: JobPostSubscriptionFilter;
};

export type CreateManyAutomationTasksInput = {
	/** Array of records to create */
	automationTasks: Array<CreateAutomationTask>;
};

export type CreateManyEmployeeJobApplicationsInput = {
	/** Array of records to create */
	employeeJobApplications: Array<CreateEmployeeJobApplication>;
};

export type CreateManyEmployeeJobPostsInput = {
	/** Array of records to create */
	employeeJobPosts: Array<CreateEmployeeJobPost>;
};

export type CreateManyEmployeesInput = {
	/** Array of records to create */
	employees: Array<CreateEmployee>;
};

export type CreateManyJobPostsInput = {
	/** Array of records to create */
	jobPosts: Array<CreateJobPost>;
};

export type CreateManyUpworkJobsSearchCriteriaInput = {
	/** Array of records to create */
	upworkJobsSearchCriteria: Array<CreateUpworkJobsSearchCriterion>;
};

export type CreateManyUsersInput = {
	/** Array of records to create */
	users: Array<CreateUser>;
};

export type CreateOneAutomationTaskInput = {
	/** The record to create */
	automationTask: CreateAutomationTask;
};

export type CreateOneEmployeeInput = {
	/** The record to create */
	employee: CreateEmployee;
};

export type CreateOneEmployeeJobApplicationInput = {
	/** The record to create */
	employeeJobApplication: CreateEmployeeJobApplication;
};

export type CreateOneEmployeeJobPostInput = {
	/** The record to create */
	employeeJobPost: CreateEmployeeJobPost;
};

export type CreateOneJobPostInput = {
	/** The record to create */
	jobPost: CreateJobPost;
};

export type CreateOneUpworkJobsSearchCriterionInput = {
	/** The record to create */
	upworkJobsSearchCriterion: CreateUpworkJobsSearchCriterion;
};

export type CreateOneUserInput = {
	/** The record to create */
	user: CreateUser;
};

export type CreateUpworkJobsSearchCriterion = {
	category?: InputMaybe<Scalars['String']['input']>;
	categoryId?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId: Scalars['String']['input'];
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	jobType: Scalars['String']['input'];
	keyword: Scalars['String']['input'];
	occupation?: InputMaybe<Scalars['String']['input']>;
	occupationId?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type CreateUpworkJobsSearchCriterionSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UpworkJobsSearchCriterionSubscriptionFilter;
};

export type CreateUser = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	email?: InputMaybe<Scalars['String']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	externalUserId?: InputMaybe<Scalars['String']['input']>;
	firstName?: InputMaybe<Scalars['String']['input']>;
	hash?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	lastName?: InputMaybe<Scalars['String']['input']>;
	name?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	username?: InputMaybe<Scalars['String']['input']>;
};

export type CreateUserSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UserSubscriptionFilter;
};

export type CursorPaging = {
	/** Paginate after opaque cursor */
	after?: InputMaybe<Scalars['ConnectionCursor']['input']>;
	/** Paginate before opaque cursor */
	before?: InputMaybe<Scalars['ConnectionCursor']['input']>;
	/** Paginate first */
	first?: InputMaybe<Scalars['Int']['input']>;
	/** Paginate last */
	last?: InputMaybe<Scalars['Int']['input']>;
};

export type DateFieldComparison = {
	between?: InputMaybe<DateFieldComparisonBetween>;
	eq?: InputMaybe<Scalars['DateTime']['input']>;
	gt?: InputMaybe<Scalars['DateTime']['input']>;
	gte?: InputMaybe<Scalars['DateTime']['input']>;
	in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
	is?: InputMaybe<Scalars['Boolean']['input']>;
	isNot?: InputMaybe<Scalars['Boolean']['input']>;
	lt?: InputMaybe<Scalars['DateTime']['input']>;
	lte?: InputMaybe<Scalars['DateTime']['input']>;
	neq?: InputMaybe<Scalars['DateTime']['input']>;
	notBetween?: InputMaybe<DateFieldComparisonBetween>;
	notIn?: InputMaybe<Array<Scalars['DateTime']['input']>>;
};

export type DateFieldComparisonBetween = {
	lower: Scalars['DateTime']['input'];
	upper: Scalars['DateTime']['input'];
};

export type DeleteManyAutomationTasksInput = {
	/** Filter to find records to delete */
	filter: AutomationTaskDeleteFilter;
};

export type DeleteManyEmployeeJobApplicationsInput = {
	/** Filter to find records to delete */
	filter: EmployeeJobApplicationDeleteFilter;
};

export type DeleteManyEmployeeJobPostsInput = {
	/** Filter to find records to delete */
	filter: EmployeeJobPostDeleteFilter;
};

export type DeleteManyEmployeesInput = {
	/** Filter to find records to delete */
	filter: EmployeeDeleteFilter;
};

export type DeleteManyJobPostsInput = {
	/** Filter to find records to delete */
	filter: JobPostDeleteFilter;
};

export type DeleteManyResponse = {
	__typename?: 'DeleteManyResponse';
	/** The number of records deleted. */
	deletedCount: Scalars['Int']['output'];
};

export type DeleteManyUpworkJobsSearchCriteriaInput = {
	/** Filter to find records to delete */
	filter: UpworkJobsSearchCriterionDeleteFilter;
};

export type DeleteManyUsersInput = {
	/** Filter to find records to delete */
	filter: UserDeleteFilter;
};

export type DeleteOneAutomationTaskInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneAutomationTaskSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: AutomationTaskSubscriptionFilter;
};

export type DeleteOneEmployeeInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneEmployeeJobApplicationInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneEmployeeJobApplicationSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobApplicationSubscriptionFilter;
};

export type DeleteOneEmployeeJobPostInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneEmployeeJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobPostSubscriptionFilter;
};

export type DeleteOneEmployeeSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeSubscriptionFilter;
};

export type DeleteOneJobPostInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: JobPostSubscriptionFilter;
};

export type DeleteOneUpworkJobsSearchCriterionInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneUpworkJobsSearchCriterionSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UpworkJobsSearchCriterionSubscriptionFilter;
};

export type DeleteOneUserInput = {
	/** The id of the record to delete. */
	id: Scalars['ID']['input'];
};

export type DeleteOneUserSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UserSubscriptionFilter;
};

export type Employee = {
	__typename?: 'Employee';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalEmployeeId?: Maybe<Scalars['String']['output']>;
	externalOrgId?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	jobType?: Maybe<Scalars['String']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	linkedInId?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	upworkId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationName?: Maybe<Scalars['String']['output']>;
	user?: Maybe<User>;
	userId?: Maybe<Scalars['String']['output']>;
};

export type EmployeeAggregateFilter = {
	and?: InputMaybe<Array<EmployeeAggregateFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeAggregateFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type EmployeeAggregateGroupBy = {
	__typename?: 'EmployeeAggregateGroupBy';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalEmployeeId?: Maybe<Scalars['String']['output']>;
	externalOrgId?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	linkedInId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	upworkId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationName?: Maybe<Scalars['String']['output']>;
	userId?: Maybe<Scalars['String']['output']>;
};


export type EmployeeAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type EmployeeAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type EmployeeAggregateResponse = {
	__typename?: 'EmployeeAggregateResponse';
	count?: Maybe<EmployeeCountAggregate>;
	groupBy?: Maybe<EmployeeAggregateGroupBy>;
	max?: Maybe<EmployeeMaxAggregate>;
	min?: Maybe<EmployeeMinAggregate>;
};

export type EmployeeConnection = {
	__typename?: 'EmployeeConnection';
	/** Array of edges. */
	edges: Array<EmployeeEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type EmployeeCountAggregate = {
	__typename?: 'EmployeeCountAggregate';
	createdAt?: Maybe<Scalars['Int']['output']>;
	externalEmployeeId?: Maybe<Scalars['Int']['output']>;
	externalOrgId?: Maybe<Scalars['Int']['output']>;
	externalTenantId?: Maybe<Scalars['Int']['output']>;
	firstName?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	jobType?: Maybe<Scalars['Int']['output']>;
	lastName?: Maybe<Scalars['Int']['output']>;
	linkedInId?: Maybe<Scalars['Int']['output']>;
	tenantId?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
	upworkId?: Maybe<Scalars['Int']['output']>;
	upworkOrganizationId?: Maybe<Scalars['Int']['output']>;
	upworkOrganizationName?: Maybe<Scalars['Int']['output']>;
	userId?: Maybe<Scalars['Int']['output']>;
};

export type EmployeeDeleteFilter = {
	and?: InputMaybe<Array<EmployeeDeleteFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeDeleteFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type EmployeeDeleteResponse = {
	__typename?: 'EmployeeDeleteResponse';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalEmployeeId?: Maybe<Scalars['String']['output']>;
	externalOrgId?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	linkedInId?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	upworkId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationName?: Maybe<Scalars['String']['output']>;
	userId?: Maybe<Scalars['String']['output']>;
};

export type EmployeeEdge = {
	__typename?: 'EmployeeEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the Employee */
	node: Employee;
};

export type EmployeeFilter = {
	and?: InputMaybe<Array<EmployeeFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type EmployeeInput = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	externalEmployeeId?: InputMaybe<Scalars['String']['input']>;
	externalOrgId?: InputMaybe<Scalars['String']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	firstName?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	jobType?: InputMaybe<Scalars['String']['input']>;
	lastName?: InputMaybe<Scalars['String']['input']>;
	linkedInId?: InputMaybe<Scalars['String']['input']>;
	name?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	upworkId?: InputMaybe<Scalars['String']['input']>;
	upworkOrganizationId?: InputMaybe<Scalars['String']['input']>;
	upworkOrganizationName?: InputMaybe<Scalars['String']['input']>;
	userId?: InputMaybe<Scalars['String']['input']>;
};

export type EmployeeJobApplication = {
	__typename?: 'EmployeeJobApplication';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	attachments?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employee?: Maybe<Employee>;
	employeeId: Scalars['String']['output'];
	employeeJobPost?: Maybe<EmployeeJobPost>;
	employeeJobPostId: Scalars['String']['output'];
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	isProposalGeneratedByAI?: Maybe<Scalars['Boolean']['output']>;
	isViewedByClient?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPost?: Maybe<JobPost>;
	jobPostId: Scalars['String']['output'];
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	proposal?: Maybe<Scalars['String']['output']>;
	proposalTemplate?: Maybe<Scalars['String']['output']>;
	providerCode: Scalars['String']['output'];
	providerJobApplicationId?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	qa?: Maybe<Scalars['String']['output']>;
	rate?: Maybe<Scalars['Float']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	terms?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobApplicationAggregateFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationAggregateFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isViewedByClient?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationAggregateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobApplicationId?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobApplicationAggregateGroupBy = {
	__typename?: 'EmployeeJobApplicationAggregateGroupBy';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	isViewedByClient?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobApplicationId?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type EmployeeJobApplicationAggregateGroupByAppliedDateArgs = {
	by?: GroupBy;
};


export type EmployeeJobApplicationAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type EmployeeJobApplicationAggregateGroupByJobDateCreatedArgs = {
	by?: GroupBy;
};


export type EmployeeJobApplicationAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type EmployeeJobApplicationAggregateResponse = {
	__typename?: 'EmployeeJobApplicationAggregateResponse';
	count?: Maybe<EmployeeJobApplicationCountAggregate>;
	groupBy?: Maybe<EmployeeJobApplicationAggregateGroupBy>;
	max?: Maybe<EmployeeJobApplicationMaxAggregate>;
	min?: Maybe<EmployeeJobApplicationMinAggregate>;
};

export type EmployeeJobApplicationConnection = {
	__typename?: 'EmployeeJobApplicationConnection';
	/** Array of edges. */
	edges: Array<EmployeeJobApplicationEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type EmployeeJobApplicationCountAggregate = {
	__typename?: 'EmployeeJobApplicationCountAggregate';
	appliedDate?: Maybe<Scalars['Int']['output']>;
	appliedStatus?: Maybe<Scalars['Int']['output']>;
	createdAt?: Maybe<Scalars['Int']['output']>;
	employeeId?: Maybe<Scalars['Int']['output']>;
	employeeJobPostId?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	isViewedByClient?: Maybe<Scalars['Int']['output']>;
	jobDateCreated?: Maybe<Scalars['Int']['output']>;
	jobPostId?: Maybe<Scalars['Int']['output']>;
	jobStatus?: Maybe<Scalars['Int']['output']>;
	jobType?: Maybe<Scalars['Int']['output']>;
	providerCode?: Maybe<Scalars['Int']['output']>;
	providerJobApplicationId?: Maybe<Scalars['Int']['output']>;
	providerJobId?: Maybe<Scalars['Int']['output']>;
	tenantId?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type EmployeeJobApplicationDeleteFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationDeleteFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isViewedByClient?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationDeleteFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobApplicationId?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobApplicationDeleteResponse = {
	__typename?: 'EmployeeJobApplicationDeleteResponse';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	attachments?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	isProposalGeneratedByAI?: Maybe<Scalars['Boolean']['output']>;
	isViewedByClient?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	proposal?: Maybe<Scalars['String']['output']>;
	proposalTemplate?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobApplicationId?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	qa?: Maybe<Scalars['String']['output']>;
	rate?: Maybe<Scalars['Float']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	terms?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobApplicationEdge = {
	__typename?: 'EmployeeJobApplicationEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the EmployeeJobApplication */
	node: EmployeeJobApplication;
};

export type EmployeeJobApplicationFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employee?: InputMaybe<EmployeeJobApplicationFilterEmployeeFilter>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPost?: InputMaybe<EmployeeJobApplicationFilterEmployeeJobPostFilter>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isViewedByClient?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPost?: InputMaybe<EmployeeJobApplicationFilterJobPostFilter>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobApplicationId?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobApplicationFilterEmployeeFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationFilterEmployeeFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationFilterEmployeeFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type EmployeeJobApplicationFilterEmployeeJobPostFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationFilterEmployeeJobPostFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationFilterEmployeeJobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobApplicationFilterJobPostFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationFilterJobPostFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationFilterJobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobApplicationMaxAggregate = {
	__typename?: 'EmployeeJobApplicationMaxAggregate';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobApplicationId?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobApplicationMinAggregate = {
	__typename?: 'EmployeeJobApplicationMinAggregate';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	employeeJobPostId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobApplicationId?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobApplicationSort = {
	direction: SortDirection;
	field: EmployeeJobApplicationSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum EmployeeJobApplicationSortFields {
	AppliedDate = 'appliedDate',
	AppliedStatus = 'appliedStatus',
	CreatedAt = 'createdAt',
	EmployeeId = 'employeeId',
	EmployeeJobPostId = 'employeeJobPostId',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	IsViewedByClient = 'isViewedByClient',
	JobDateCreated = 'jobDateCreated',
	JobPostId = 'jobPostId',
	JobStatus = 'jobStatus',
	JobType = 'jobType',
	ProviderCode = 'providerCode',
	ProviderJobApplicationId = 'providerJobApplicationId',
	ProviderJobId = 'providerJobId',
	TenantId = 'tenantId',
	UpdatedAt = 'updatedAt'
}

export type EmployeeJobApplicationSubscriptionFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationSubscriptionFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isViewedByClient?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationSubscriptionFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobApplicationId?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobApplicationUpdateFilter = {
	and?: InputMaybe<Array<EmployeeJobApplicationUpdateFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	employeeJobPostId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	isViewedByClient?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobApplicationUpdateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobApplicationId?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobPost = {
	__typename?: 'EmployeeJobPost';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employee?: Maybe<Employee>;
	employeeId: Scalars['String']['output'];
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isApplied?: Maybe<Scalars['Boolean']['output']>;
	isArchived: Scalars['Boolean']['output'];
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPost?: Maybe<JobPost>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode: Scalars['String']['output'];
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobPostAggregateFilter = {
	and?: InputMaybe<Array<EmployeeJobPostAggregateFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostAggregateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobPostAggregateGroupBy = {
	__typename?: 'EmployeeJobPostAggregateGroupBy';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isApplied?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type EmployeeJobPostAggregateGroupByAppliedDateArgs = {
	by?: GroupBy;
};


export type EmployeeJobPostAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type EmployeeJobPostAggregateGroupByJobDateCreatedArgs = {
	by?: GroupBy;
};


export type EmployeeJobPostAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type EmployeeJobPostAggregateResponse = {
	__typename?: 'EmployeeJobPostAggregateResponse';
	count?: Maybe<EmployeeJobPostCountAggregate>;
	groupBy?: Maybe<EmployeeJobPostAggregateGroupBy>;
	max?: Maybe<EmployeeJobPostMaxAggregate>;
	min?: Maybe<EmployeeJobPostMinAggregate>;
};

export type EmployeeJobPostConnection = {
	__typename?: 'EmployeeJobPostConnection';
	/** Array of edges. */
	edges: Array<EmployeeJobPostEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type EmployeeJobPostCountAggregate = {
	__typename?: 'EmployeeJobPostCountAggregate';
	appliedDate?: Maybe<Scalars['Int']['output']>;
	appliedStatus?: Maybe<Scalars['Int']['output']>;
	createdAt?: Maybe<Scalars['Int']['output']>;
	employeeId?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isApplied?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	jobDateCreated?: Maybe<Scalars['Int']['output']>;
	jobPostId?: Maybe<Scalars['Int']['output']>;
	jobStatus?: Maybe<Scalars['Int']['output']>;
	jobType?: Maybe<Scalars['Int']['output']>;
	providerCode?: Maybe<Scalars['Int']['output']>;
	providerJobId?: Maybe<Scalars['Int']['output']>;
	tenantId?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type EmployeeJobPostDeleteFilter = {
	and?: InputMaybe<Array<EmployeeJobPostDeleteFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostDeleteFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobPostDeleteResponse = {
	__typename?: 'EmployeeJobPostDeleteResponse';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isApplied?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobPostEdge = {
	__typename?: 'EmployeeJobPostEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the EmployeeJobPost */
	node: EmployeeJobPost;
};

export type EmployeeJobPostFilter = {
	and?: InputMaybe<Array<EmployeeJobPostFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employee?: InputMaybe<EmployeeJobPostFilterEmployeeFilter>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPost?: InputMaybe<EmployeeJobPostFilterJobPostFilter>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobPostFilterEmployeeFilter = {
	and?: InputMaybe<Array<EmployeeJobPostFilterEmployeeFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostFilterEmployeeFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type EmployeeJobPostFilterJobPostFilter = {
	and?: InputMaybe<Array<EmployeeJobPostFilterJobPostFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostFilterJobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobPostInput = {
	appliedDate?: InputMaybe<Scalars['DateTime']['input']>;
	appliedStatus?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId: Scalars['String']['input'];
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isApplied?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived: Scalars['Boolean']['input'];
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId?: InputMaybe<Scalars['String']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	providerCode: Scalars['String']['input'];
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type EmployeeJobPostMaxAggregate = {
	__typename?: 'EmployeeJobPostMaxAggregate';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobPostMinAggregate = {
	__typename?: 'EmployeeJobPostMinAggregate';
	appliedDate?: Maybe<Scalars['DateTime']['output']>;
	appliedStatus?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobPostId?: Maybe<Scalars['String']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type EmployeeJobPostSort = {
	direction: SortDirection;
	field: EmployeeJobPostSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum EmployeeJobPostSortFields {
	AppliedDate = 'appliedDate',
	AppliedStatus = 'appliedStatus',
	CreatedAt = 'createdAt',
	EmployeeId = 'employeeId',
	Id = 'id',
	IsActive = 'isActive',
	IsApplied = 'isApplied',
	IsArchived = 'isArchived',
	JobDateCreated = 'jobDateCreated',
	JobPostId = 'jobPostId',
	JobStatus = 'jobStatus',
	JobType = 'jobType',
	ProviderCode = 'providerCode',
	ProviderJobId = 'providerJobId',
	TenantId = 'tenantId',
	UpdatedAt = 'updatedAt'
}

export type EmployeeJobPostSubscriptionFilter = {
	and?: InputMaybe<Array<EmployeeJobPostSubscriptionFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostSubscriptionFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeJobPostUpdateFilter = {
	and?: InputMaybe<Array<EmployeeJobPostUpdateFilter>>;
	appliedDate?: InputMaybe<DateFieldComparison>;
	appliedStatus?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isApplied?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobPostId?: InputMaybe<StringFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeJobPostUpdateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type EmployeeMaxAggregate = {
	__typename?: 'EmployeeMaxAggregate';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalEmployeeId?: Maybe<Scalars['String']['output']>;
	externalOrgId?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	linkedInId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	upworkId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationName?: Maybe<Scalars['String']['output']>;
	userId?: Maybe<Scalars['String']['output']>;
};

export type EmployeeMinAggregate = {
	__typename?: 'EmployeeMinAggregate';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalEmployeeId?: Maybe<Scalars['String']['output']>;
	externalOrgId?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	linkedInId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	upworkId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationId?: Maybe<Scalars['String']['output']>;
	upworkOrganizationName?: Maybe<Scalars['String']['output']>;
	userId?: Maybe<Scalars['String']['output']>;
};

export type EmployeeSort = {
	direction: SortDirection;
	field: EmployeeSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum EmployeeSortFields {
	CreatedAt = 'createdAt',
	ExternalEmployeeId = 'externalEmployeeId',
	ExternalOrgId = 'externalOrgId',
	ExternalTenantId = 'externalTenantId',
	FirstName = 'firstName',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	JobType = 'jobType',
	LastName = 'lastName',
	LinkedInId = 'linkedInId',
	TenantId = 'tenantId',
	UpdatedAt = 'updatedAt',
	UpworkId = 'upworkId',
	UpworkOrganizationId = 'upworkOrganizationId',
	UpworkOrganizationName = 'upworkOrganizationName',
	UserId = 'userId'
}

export type EmployeeSubscriptionFilter = {
	and?: InputMaybe<Array<EmployeeSubscriptionFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeSubscriptionFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

export type EmployeeUpdateFilter = {
	and?: InputMaybe<Array<EmployeeUpdateFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalEmployeeId?: InputMaybe<StringFieldComparison>;
	externalOrgId?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	linkedInId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<EmployeeUpdateFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	upworkId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationId?: InputMaybe<StringFieldComparison>;
	upworkOrganizationName?: InputMaybe<StringFieldComparison>;
	userId?: InputMaybe<StringFieldComparison>;
};

/** Group by */
export enum GroupBy {
	Day = 'DAY',
	Month = 'MONTH',
	Week = 'WEEK',
	Year = 'YEAR'
}

export type IdFilterComparison = {
	eq?: InputMaybe<Scalars['ID']['input']>;
	gt?: InputMaybe<Scalars['ID']['input']>;
	gte?: InputMaybe<Scalars['ID']['input']>;
	iLike?: InputMaybe<Scalars['ID']['input']>;
	in?: InputMaybe<Array<Scalars['ID']['input']>>;
	is?: InputMaybe<Scalars['Boolean']['input']>;
	isNot?: InputMaybe<Scalars['Boolean']['input']>;
	like?: InputMaybe<Scalars['ID']['input']>;
	lt?: InputMaybe<Scalars['ID']['input']>;
	lte?: InputMaybe<Scalars['ID']['input']>;
	neq?: InputMaybe<Scalars['ID']['input']>;
	notILike?: InputMaybe<Scalars['ID']['input']>;
	notIn?: InputMaybe<Array<Scalars['ID']['input']>>;
	notLike?: InputMaybe<Scalars['ID']['input']>;
};

export type JobPost = {
	__typename?: 'JobPost';
	budget?: Maybe<Scalars['String']['output']>;
	category?: Maybe<Scalars['String']['output']>;
	clientFeedback?: Maybe<Scalars['String']['output']>;
	clientJobsPosted?: Maybe<Scalars['Float']['output']>;
	clientPastHires?: Maybe<Scalars['Float']['output']>;
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']['output']>;
	clientReviewsCount?: Maybe<Scalars['Float']['output']>;
	contractToHire?: Maybe<Scalars['Boolean']['output']>;
	country?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	description: Scalars['String']['output'];
	duration?: Maybe<Scalars['String']['output']>;
	englishLevel?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	interviewingCount?: Maybe<Scalars['Float']['output']>;
	invitesSentCount?: Maybe<Scalars['Float']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	languages?: Maybe<Scalars['String']['output']>;
	proposalsCount?: Maybe<Scalars['Float']['output']>;
	providerCode: Scalars['String']['output'];
	providerJobId?: Maybe<Scalars['String']['output']>;
	searchCategory?: Maybe<Scalars['String']['output']>;
	searchCategoryId?: Maybe<Scalars['String']['output']>;
	searchJobType?: Maybe<Scalars['String']['output']>;
	searchKeyword?: Maybe<Scalars['String']['output']>;
	searchOccupation?: Maybe<Scalars['String']['output']>;
	searchOccupationId?: Maybe<Scalars['String']['output']>;
	skills?: Maybe<Scalars['String']['output']>;
	subcategory?: Maybe<Scalars['String']['output']>;
	title: Scalars['String']['output'];
	unansweredInvitesCount?: Maybe<Scalars['Float']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	url?: Maybe<Scalars['String']['output']>;
	workload?: Maybe<Scalars['String']['output']>;
};

export type JobPostAggregateFilter = {
	and?: InputMaybe<Array<JobPostAggregateFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<JobPostAggregateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type JobPostAggregateGroupBy = {
	__typename?: 'JobPostAggregateGroupBy';
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']['output']>;
	country?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	englishLevel?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	searchCategory?: Maybe<Scalars['String']['output']>;
	searchCategoryId?: Maybe<Scalars['String']['output']>;
	searchJobType?: Maybe<Scalars['String']['output']>;
	searchOccupation?: Maybe<Scalars['String']['output']>;
	searchOccupationId?: Maybe<Scalars['String']['output']>;
	title?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type JobPostAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type JobPostAggregateGroupByJobDateCreatedArgs = {
	by?: GroupBy;
};


export type JobPostAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type JobPostAggregateResponse = {
	__typename?: 'JobPostAggregateResponse';
	count?: Maybe<JobPostCountAggregate>;
	groupBy?: Maybe<JobPostAggregateGroupBy>;
	max?: Maybe<JobPostMaxAggregate>;
	min?: Maybe<JobPostMinAggregate>;
};

export type JobPostConnection = {
	__typename?: 'JobPostConnection';
	/** Array of edges. */
	edges: Array<JobPostEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type JobPostCountAggregate = {
	__typename?: 'JobPostCountAggregate';
	clientPaymentVerificationStatus?: Maybe<Scalars['Int']['output']>;
	country?: Maybe<Scalars['Int']['output']>;
	createdAt?: Maybe<Scalars['Int']['output']>;
	englishLevel?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	jobDateCreated?: Maybe<Scalars['Int']['output']>;
	jobStatus?: Maybe<Scalars['Int']['output']>;
	jobType?: Maybe<Scalars['Int']['output']>;
	providerCode?: Maybe<Scalars['Int']['output']>;
	providerJobId?: Maybe<Scalars['Int']['output']>;
	searchCategory?: Maybe<Scalars['Int']['output']>;
	searchCategoryId?: Maybe<Scalars['Int']['output']>;
	searchJobType?: Maybe<Scalars['Int']['output']>;
	searchOccupation?: Maybe<Scalars['Int']['output']>;
	searchOccupationId?: Maybe<Scalars['Int']['output']>;
	title?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type JobPostDeleteFilter = {
	and?: InputMaybe<Array<JobPostDeleteFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<JobPostDeleteFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type JobPostDeleteResponse = {
	__typename?: 'JobPostDeleteResponse';
	budget?: Maybe<Scalars['String']['output']>;
	category?: Maybe<Scalars['String']['output']>;
	clientFeedback?: Maybe<Scalars['String']['output']>;
	clientJobsPosted?: Maybe<Scalars['Float']['output']>;
	clientPastHires?: Maybe<Scalars['Float']['output']>;
	clientPaymentVerificationStatus?: Maybe<Scalars['Boolean']['output']>;
	clientReviewsCount?: Maybe<Scalars['Float']['output']>;
	contractToHire?: Maybe<Scalars['Boolean']['output']>;
	country?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	description?: Maybe<Scalars['String']['output']>;
	duration?: Maybe<Scalars['String']['output']>;
	englishLevel?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	interviewingCount?: Maybe<Scalars['Float']['output']>;
	invitesSentCount?: Maybe<Scalars['Float']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	languages?: Maybe<Scalars['String']['output']>;
	proposalsCount?: Maybe<Scalars['Float']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	searchCategory?: Maybe<Scalars['String']['output']>;
	searchCategoryId?: Maybe<Scalars['String']['output']>;
	searchJobType?: Maybe<Scalars['String']['output']>;
	searchKeyword?: Maybe<Scalars['String']['output']>;
	searchOccupation?: Maybe<Scalars['String']['output']>;
	searchOccupationId?: Maybe<Scalars['String']['output']>;
	skills?: Maybe<Scalars['String']['output']>;
	subcategory?: Maybe<Scalars['String']['output']>;
	title?: Maybe<Scalars['String']['output']>;
	unansweredInvitesCount?: Maybe<Scalars['Float']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	url?: Maybe<Scalars['String']['output']>;
	workload?: Maybe<Scalars['String']['output']>;
};

export type JobPostEdge = {
	__typename?: 'JobPostEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the JobPost */
	node: JobPost;
};

export type JobPostFilter = {
	and?: InputMaybe<Array<JobPostFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<JobPostFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type JobPostInput = {
	budget?: InputMaybe<Scalars['String']['input']>;
	category?: InputMaybe<Scalars['String']['input']>;
	clientFeedback?: InputMaybe<Scalars['String']['input']>;
	clientJobsPosted?: InputMaybe<Scalars['Float']['input']>;
	clientPastHires?: InputMaybe<Scalars['Float']['input']>;
	clientPaymentVerificationStatus?: InputMaybe<Scalars['Boolean']['input']>;
	clientReviewsCount?: InputMaybe<Scalars['Float']['input']>;
	contractToHire?: InputMaybe<Scalars['Boolean']['input']>;
	country?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	description: Scalars['String']['input'];
	duration?: InputMaybe<Scalars['String']['input']>;
	englishLevel?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	interviewingCount?: InputMaybe<Scalars['Float']['input']>;
	invitesSentCount?: InputMaybe<Scalars['Float']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	languages?: InputMaybe<Scalars['String']['input']>;
	proposalsCount?: InputMaybe<Scalars['Float']['input']>;
	providerCode: Scalars['String']['input'];
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	searchCategory?: InputMaybe<Scalars['String']['input']>;
	searchCategoryId?: InputMaybe<Scalars['String']['input']>;
	searchJobType?: InputMaybe<Scalars['String']['input']>;
	searchKeyword?: InputMaybe<Scalars['String']['input']>;
	searchOccupation?: InputMaybe<Scalars['String']['input']>;
	searchOccupationId?: InputMaybe<Scalars['String']['input']>;
	skills?: InputMaybe<Scalars['String']['input']>;
	subcategory?: InputMaybe<Scalars['String']['input']>;
	title: Scalars['String']['input'];
	unansweredInvitesCount?: InputMaybe<Scalars['Float']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	url?: InputMaybe<Scalars['String']['input']>;
	workload?: InputMaybe<Scalars['String']['input']>;
};

export type JobPostMaxAggregate = {
	__typename?: 'JobPostMaxAggregate';
	country?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	englishLevel?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	searchCategory?: Maybe<Scalars['String']['output']>;
	searchCategoryId?: Maybe<Scalars['String']['output']>;
	searchJobType?: Maybe<Scalars['String']['output']>;
	searchOccupation?: Maybe<Scalars['String']['output']>;
	searchOccupationId?: Maybe<Scalars['String']['output']>;
	title?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type JobPostMinAggregate = {
	__typename?: 'JobPostMinAggregate';
	country?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	englishLevel?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobDateCreated?: Maybe<Scalars['DateTime']['output']>;
	jobStatus?: Maybe<Scalars['String']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	providerCode?: Maybe<Scalars['String']['output']>;
	providerJobId?: Maybe<Scalars['String']['output']>;
	searchCategory?: Maybe<Scalars['String']['output']>;
	searchCategoryId?: Maybe<Scalars['String']['output']>;
	searchJobType?: Maybe<Scalars['String']['output']>;
	searchOccupation?: Maybe<Scalars['String']['output']>;
	searchOccupationId?: Maybe<Scalars['String']['output']>;
	title?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type JobPostSort = {
	direction: SortDirection;
	field: JobPostSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum JobPostSortFields {
	ClientPaymentVerificationStatus = 'clientPaymentVerificationStatus',
	Country = 'country',
	CreatedAt = 'createdAt',
	EnglishLevel = 'englishLevel',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	JobDateCreated = 'jobDateCreated',
	JobStatus = 'jobStatus',
	JobType = 'jobType',
	ProviderCode = 'providerCode',
	ProviderJobId = 'providerJobId',
	SearchCategory = 'searchCategory',
	SearchCategoryId = 'searchCategoryId',
	SearchJobType = 'searchJobType',
	SearchOccupation = 'searchOccupation',
	SearchOccupationId = 'searchOccupationId',
	Title = 'title',
	UpdatedAt = 'updatedAt'
}

export type JobPostSubscriptionFilter = {
	and?: InputMaybe<Array<JobPostSubscriptionFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<JobPostSubscriptionFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type JobPostUpdateFilter = {
	and?: InputMaybe<Array<JobPostUpdateFilter>>;
	clientPaymentVerificationStatus?: InputMaybe<BooleanFieldComparison>;
	country?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	englishLevel?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobDateCreated?: InputMaybe<DateFieldComparison>;
	jobStatus?: InputMaybe<StringFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<JobPostUpdateFilter>>;
	providerCode?: InputMaybe<StringFieldComparison>;
	providerJobId?: InputMaybe<StringFieldComparison>;
	searchCategory?: InputMaybe<StringFieldComparison>;
	searchCategoryId?: InputMaybe<StringFieldComparison>;
	searchJobType?: InputMaybe<StringFieldComparison>;
	searchOccupation?: InputMaybe<StringFieldComparison>;
	searchOccupationId?: InputMaybe<StringFieldComparison>;
	title?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type Mutation = {
	__typename?: 'Mutation';
	createManyAutomationTasks: Array<AutomationTask>;
	createManyEmployeeJobApplications: Array<EmployeeJobApplication>;
	createManyEmployeeJobPosts: Array<EmployeeJobPost>;
	createManyEmployees: Array<Employee>;
	createManyJobPosts: Array<JobPost>;
	createManyUpworkJobsSearchCriteria: Array<UpworkJobsSearchCriterion>;
	createManyUsers: Array<User>;
	createOneAutomationTask: AutomationTask;
	createOneEmployee: Employee;
	createOneEmployeeJobApplication: EmployeeJobApplication;
	createOneEmployeeJobPost: EmployeeJobPost;
	createOneJobPost: JobPost;
	createOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	createOneUser: User;
	deleteManyAutomationTasks: DeleteManyResponse;
	deleteManyEmployeeJobApplications: DeleteManyResponse;
	deleteManyEmployeeJobPosts: DeleteManyResponse;
	deleteManyEmployees: DeleteManyResponse;
	deleteManyJobPosts: DeleteManyResponse;
	deleteManyUpworkJobsSearchCriteria: DeleteManyResponse;
	deleteManyUsers: DeleteManyResponse;
	deleteOneAutomationTask: AutomationTaskDeleteResponse;
	deleteOneEmployee: EmployeeDeleteResponse;
	deleteOneEmployeeJobApplication: EmployeeJobApplicationDeleteResponse;
	deleteOneEmployeeJobPost: EmployeeJobPostDeleteResponse;
	deleteOneJobPost: JobPostDeleteResponse;
	deleteOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterionDeleteResponse;
	deleteOneUser: UserDeleteResponse;
	updateManyAutomationTasks: UpdateManyResponse;
	updateManyEmployeeJobApplications: UpdateManyResponse;
	updateManyEmployeeJobPosts: UpdateManyResponse;
	updateManyEmployees: UpdateManyResponse;
	updateManyJobPosts: UpdateManyResponse;
	updateManyTenantApiKeys: UpdateManyResponse;
	updateManyUpworkJobsSearchCriteria: UpdateManyResponse;
	updateManyUsers: UpdateManyResponse;
	updateOneAutomationTask: AutomationTask;
	updateOneEmployee: Employee;
	updateOneEmployeeJobApplication: EmployeeJobApplication;
	updateOneEmployeeJobPost: EmployeeJobPost;
	updateOneJobPost: JobPost;
	updateOneTenantApiKey: TenantApiKey;
	updateOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	updateOneUser: User;
};


export type MutationCreateManyAutomationTasksArgs = {
	input: CreateManyAutomationTasksInput;
};


export type MutationCreateManyEmployeeJobApplicationsArgs = {
	input: CreateManyEmployeeJobApplicationsInput;
};


export type MutationCreateManyEmployeeJobPostsArgs = {
	input: CreateManyEmployeeJobPostsInput;
};


export type MutationCreateManyEmployeesArgs = {
	input: CreateManyEmployeesInput;
};


export type MutationCreateManyJobPostsArgs = {
	input: CreateManyJobPostsInput;
};


export type MutationCreateManyUpworkJobsSearchCriteriaArgs = {
	input: CreateManyUpworkJobsSearchCriteriaInput;
};


export type MutationCreateManyUsersArgs = {
	input: CreateManyUsersInput;
};


export type MutationCreateOneAutomationTaskArgs = {
	input: CreateOneAutomationTaskInput;
};


export type MutationCreateOneEmployeeArgs = {
	input: CreateOneEmployeeInput;
};


export type MutationCreateOneEmployeeJobApplicationArgs = {
	input: CreateOneEmployeeJobApplicationInput;
};


export type MutationCreateOneEmployeeJobPostArgs = {
	input: CreateOneEmployeeJobPostInput;
};


export type MutationCreateOneJobPostArgs = {
	input: CreateOneJobPostInput;
};


export type MutationCreateOneUpworkJobsSearchCriterionArgs = {
	input: CreateOneUpworkJobsSearchCriterionInput;
};


export type MutationCreateOneUserArgs = {
	input: CreateOneUserInput;
};


export type MutationDeleteManyAutomationTasksArgs = {
	input: DeleteManyAutomationTasksInput;
};


export type MutationDeleteManyEmployeeJobApplicationsArgs = {
	input: DeleteManyEmployeeJobApplicationsInput;
};


export type MutationDeleteManyEmployeeJobPostsArgs = {
	input: DeleteManyEmployeeJobPostsInput;
};


export type MutationDeleteManyEmployeesArgs = {
	input: DeleteManyEmployeesInput;
};


export type MutationDeleteManyJobPostsArgs = {
	input: DeleteManyJobPostsInput;
};


export type MutationDeleteManyUpworkJobsSearchCriteriaArgs = {
	input: DeleteManyUpworkJobsSearchCriteriaInput;
};


export type MutationDeleteManyUsersArgs = {
	input: DeleteManyUsersInput;
};


export type MutationDeleteOneAutomationTaskArgs = {
	input: DeleteOneAutomationTaskInput;
};


export type MutationDeleteOneEmployeeArgs = {
	input: DeleteOneEmployeeInput;
};


export type MutationDeleteOneEmployeeJobApplicationArgs = {
	input: DeleteOneEmployeeJobApplicationInput;
};


export type MutationDeleteOneEmployeeJobPostArgs = {
	input: DeleteOneEmployeeJobPostInput;
};


export type MutationDeleteOneJobPostArgs = {
	input: DeleteOneJobPostInput;
};


export type MutationDeleteOneUpworkJobsSearchCriterionArgs = {
	input: DeleteOneUpworkJobsSearchCriterionInput;
};


export type MutationDeleteOneUserArgs = {
	input: DeleteOneUserInput;
};


export type MutationUpdateManyAutomationTasksArgs = {
	input: UpdateManyAutomationTasksInput;
};


export type MutationUpdateManyEmployeeJobApplicationsArgs = {
	input: UpdateManyEmployeeJobApplicationsInput;
};


export type MutationUpdateManyEmployeeJobPostsArgs = {
	input: UpdateManyEmployeeJobPostsInput;
};


export type MutationUpdateManyEmployeesArgs = {
	input: UpdateManyEmployeesInput;
};


export type MutationUpdateManyJobPostsArgs = {
	input: UpdateManyJobPostsInput;
};


export type MutationUpdateManyTenantApiKeysArgs = {
	input: UpdateManyTenantApiKeysInput;
};


export type MutationUpdateManyUpworkJobsSearchCriteriaArgs = {
	input: UpdateManyUpworkJobsSearchCriteriaInput;
};


export type MutationUpdateManyUsersArgs = {
	input: UpdateManyUsersInput;
};


export type MutationUpdateOneAutomationTaskArgs = {
	input: UpdateOneAutomationTaskInput;
};


export type MutationUpdateOneEmployeeArgs = {
	input: UpdateOneEmployeeInput;
};


export type MutationUpdateOneEmployeeJobApplicationArgs = {
	input: UpdateOneEmployeeJobApplicationInput;
};


export type MutationUpdateOneEmployeeJobPostArgs = {
	input: UpdateOneEmployeeJobPostInput;
};


export type MutationUpdateOneJobPostArgs = {
	input: UpdateOneJobPostInput;
};


export type MutationUpdateOneTenantApiKeyArgs = {
	input: UpdateOneTenantApiKeyInput;
};


export type MutationUpdateOneUpworkJobsSearchCriterionArgs = {
	input: UpdateOneUpworkJobsSearchCriterionInput;
};


export type MutationUpdateOneUserArgs = {
	input: UpdateOneUserInput;
};

export type PageInfo = {
	__typename?: 'PageInfo';
	/** The cursor of the last returned record. */
	endCursor?: Maybe<Scalars['ConnectionCursor']['output']>;
	/** true if paging forward and there are more records. */
	hasNextPage?: Maybe<Scalars['Boolean']['output']>;
	/** true if paging backwards and there are more records. */
	hasPreviousPage?: Maybe<Scalars['Boolean']['output']>;
	/** The cursor of the first returned record. */
	startCursor?: Maybe<Scalars['ConnectionCursor']['output']>;
};

export type Query = {
	__typename?: 'Query';
	automationTask: AutomationTask;
	automationTaskAggregate: Array<AutomationTaskAggregateResponse>;
	automationTasks: AutomationTaskConnection;
	employee: Employee;
	employeeAggregate: Array<EmployeeAggregateResponse>;
	employeeJobApplication: EmployeeJobApplication;
	employeeJobApplicationAggregate: Array<EmployeeJobApplicationAggregateResponse>;
	employeeJobApplications: EmployeeJobApplicationConnection;
	employeeJobPost: EmployeeJobPost;
	employeeJobPostAggregate: Array<EmployeeJobPostAggregateResponse>;
	employeeJobPosts: EmployeeJobPostConnection;
	employees: EmployeeConnection;
	jobPost: JobPost;
	jobPostAggregate: Array<JobPostAggregateResponse>;
	jobPosts: JobPostConnection;
	tenant: Tenant;
	tenantAggregate: Array<TenantAggregateResponse>;
	tenantApiKey: TenantApiKey;
	tenantApiKeys: TenantApiKeyConnection;
	tenants: TenantConnection;
	upworkJobsSearchCriteria: UpworkJobsSearchCriterionConnection;
	upworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	upworkJobsSearchCriterionAggregate: Array<UpworkJobsSearchCriterionAggregateResponse>;
	user: User;
	userAggregate: Array<UserAggregateResponse>;
	users: UserConnection;
};


export type QueryAutomationTaskArgs = {
	id: Scalars['ID']['input'];
};


export type QueryAutomationTaskAggregateArgs = {
	filter?: InputMaybe<AutomationTaskAggregateFilter>;
};


export type QueryAutomationTasksArgs = {
	filter?: AutomationTaskFilter;
	paging?: CursorPaging;
	sorting?: Array<AutomationTaskSort>;
};


export type QueryEmployeeArgs = {
	id: Scalars['ID']['input'];
};


export type QueryEmployeeAggregateArgs = {
	filter?: InputMaybe<EmployeeAggregateFilter>;
};


export type QueryEmployeeJobApplicationArgs = {
	id: Scalars['ID']['input'];
};


export type QueryEmployeeJobApplicationAggregateArgs = {
	filter?: InputMaybe<EmployeeJobApplicationAggregateFilter>;
};


export type QueryEmployeeJobApplicationsArgs = {
	filter?: EmployeeJobApplicationFilter;
	paging?: CursorPaging;
	sorting?: Array<EmployeeJobApplicationSort>;
};


export type QueryEmployeeJobPostArgs = {
	id: Scalars['ID']['input'];
};


export type QueryEmployeeJobPostAggregateArgs = {
	filter?: InputMaybe<EmployeeJobPostAggregateFilter>;
};


export type QueryEmployeeJobPostsArgs = {
	filter?: EmployeeJobPostFilter;
	paging?: CursorPaging;
	sorting?: Array<EmployeeJobPostSort>;
};


export type QueryEmployeesArgs = {
	filter?: EmployeeFilter;
	paging?: CursorPaging;
	sorting?: Array<EmployeeSort>;
};


export type QueryJobPostArgs = {
	id: Scalars['ID']['input'];
};


export type QueryJobPostAggregateArgs = {
	filter?: InputMaybe<JobPostAggregateFilter>;
};


export type QueryJobPostsArgs = {
	filter?: JobPostFilter;
	paging?: CursorPaging;
	sorting?: Array<JobPostSort>;
};


export type QueryTenantArgs = {
	id: Scalars['ID']['input'];
};


export type QueryTenantAggregateArgs = {
	filter?: InputMaybe<TenantAggregateFilter>;
};


export type QueryTenantApiKeyArgs = {
	id: Scalars['ID']['input'];
};


export type QueryTenantApiKeysArgs = {
	filter?: TenantApiKeyFilter;
	paging?: CursorPaging;
	sorting?: Array<TenantApiKeySort>;
};


export type QueryTenantsArgs = {
	filter?: TenantFilter;
	paging?: CursorPaging;
	sorting?: Array<TenantSort>;
};


export type QueryUpworkJobsSearchCriteriaArgs = {
	filter?: UpworkJobsSearchCriterionFilter;
	paging?: CursorPaging;
	sorting?: Array<UpworkJobsSearchCriterionSort>;
};


export type QueryUpworkJobsSearchCriterionArgs = {
	id: Scalars['ID']['input'];
};


export type QueryUpworkJobsSearchCriterionAggregateArgs = {
	filter?: InputMaybe<UpworkJobsSearchCriterionAggregateFilter>;
};


export type QueryUserArgs = {
	id: Scalars['ID']['input'];
};


export type QueryUserAggregateArgs = {
	filter?: InputMaybe<UserAggregateFilter>;
};


export type QueryUsersArgs = {
	filter?: UserFilter;
	paging?: CursorPaging;
	sorting?: Array<UserSort>;
};

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

export type StringFieldComparison = {
	eq?: InputMaybe<Scalars['String']['input']>;
	gt?: InputMaybe<Scalars['String']['input']>;
	gte?: InputMaybe<Scalars['String']['input']>;
	iLike?: InputMaybe<Scalars['String']['input']>;
	in?: InputMaybe<Array<Scalars['String']['input']>>;
	is?: InputMaybe<Scalars['Boolean']['input']>;
	isNot?: InputMaybe<Scalars['Boolean']['input']>;
	like?: InputMaybe<Scalars['String']['input']>;
	lt?: InputMaybe<Scalars['String']['input']>;
	lte?: InputMaybe<Scalars['String']['input']>;
	neq?: InputMaybe<Scalars['String']['input']>;
	notILike?: InputMaybe<Scalars['String']['input']>;
	notIn?: InputMaybe<Array<Scalars['String']['input']>>;
	notLike?: InputMaybe<Scalars['String']['input']>;
};

export type Subscription = {
	__typename?: 'Subscription';
	createdAutomationTask: AutomationTask;
	createdEmployee: Employee;
	createdEmployeeJobApplication: EmployeeJobApplication;
	createdEmployeeJobPost: EmployeeJobPost;
	createdJobPost: JobPost;
	createdUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	createdUser: User;
	deletedManyAutomationTasks: DeleteManyResponse;
	deletedManyEmployeeJobApplications: DeleteManyResponse;
	deletedManyEmployeeJobPosts: DeleteManyResponse;
	deletedManyEmployees: DeleteManyResponse;
	deletedManyJobPosts: DeleteManyResponse;
	deletedManyUpworkJobsSearchCriteria: DeleteManyResponse;
	deletedManyUsers: DeleteManyResponse;
	deletedOneAutomationTask: AutomationTaskDeleteResponse;
	deletedOneEmployee: EmployeeDeleteResponse;
	deletedOneEmployeeJobApplication: EmployeeJobApplicationDeleteResponse;
	deletedOneEmployeeJobPost: EmployeeJobPostDeleteResponse;
	deletedOneJobPost: JobPostDeleteResponse;
	deletedOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterionDeleteResponse;
	deletedOneUser: UserDeleteResponse;
	updatedManyAutomationTasks: UpdateManyResponse;
	updatedManyEmployeeJobApplications: UpdateManyResponse;
	updatedManyEmployeeJobPosts: UpdateManyResponse;
	updatedManyEmployees: UpdateManyResponse;
	updatedManyJobPosts: UpdateManyResponse;
	updatedManyUpworkJobsSearchCriteria: UpdateManyResponse;
	updatedManyUsers: UpdateManyResponse;
	updatedOneAutomationTask: AutomationTask;
	updatedOneEmployee: Employee;
	updatedOneEmployeeJobApplication: EmployeeJobApplication;
	updatedOneEmployeeJobPost: EmployeeJobPost;
	updatedOneJobPost: JobPost;
	updatedOneUpworkJobsSearchCriterion: UpworkJobsSearchCriterion;
	updatedOneUser: User;
};


export type SubscriptionCreatedAutomationTaskArgs = {
	input?: InputMaybe<CreateAutomationTaskSubscriptionFilterInput>;
};


export type SubscriptionCreatedEmployeeArgs = {
	input?: InputMaybe<CreateEmployeeSubscriptionFilterInput>;
};


export type SubscriptionCreatedEmployeeJobApplicationArgs = {
	input?: InputMaybe<CreateEmployeeJobApplicationSubscriptionFilterInput>;
};


export type SubscriptionCreatedEmployeeJobPostArgs = {
	input?: InputMaybe<CreateEmployeeJobPostSubscriptionFilterInput>;
};


export type SubscriptionCreatedJobPostArgs = {
	input?: InputMaybe<CreateJobPostSubscriptionFilterInput>;
};


export type SubscriptionCreatedUpworkJobsSearchCriterionArgs = {
	input?: InputMaybe<CreateUpworkJobsSearchCriterionSubscriptionFilterInput>;
};


export type SubscriptionCreatedUserArgs = {
	input?: InputMaybe<CreateUserSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneAutomationTaskArgs = {
	input?: InputMaybe<DeleteOneAutomationTaskSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneEmployeeArgs = {
	input?: InputMaybe<DeleteOneEmployeeSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneEmployeeJobApplicationArgs = {
	input?: InputMaybe<DeleteOneEmployeeJobApplicationSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneEmployeeJobPostArgs = {
	input?: InputMaybe<DeleteOneEmployeeJobPostSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneJobPostArgs = {
	input?: InputMaybe<DeleteOneJobPostSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneUpworkJobsSearchCriterionArgs = {
	input?: InputMaybe<DeleteOneUpworkJobsSearchCriterionSubscriptionFilterInput>;
};


export type SubscriptionDeletedOneUserArgs = {
	input?: InputMaybe<DeleteOneUserSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneAutomationTaskArgs = {
	input?: InputMaybe<UpdateOneAutomationTaskSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneEmployeeArgs = {
	input?: InputMaybe<UpdateOneEmployeeSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneEmployeeJobApplicationArgs = {
	input?: InputMaybe<UpdateOneEmployeeJobApplicationSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneEmployeeJobPostArgs = {
	input?: InputMaybe<UpdateOneEmployeeJobPostSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneJobPostArgs = {
	input?: InputMaybe<UpdateOneJobPostSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneUpworkJobsSearchCriterionArgs = {
	input?: InputMaybe<UpdateOneUpworkJobsSearchCriterionSubscriptionFilterInput>;
};


export type SubscriptionUpdatedOneUserArgs = {
	input?: InputMaybe<UpdateOneUserSubscriptionFilterInput>;
};

export type Tenant = {
	__typename?: 'Tenant';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	logo?: Maybe<Scalars['String']['output']>;
	name: Scalars['String']['output'];
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TenantAggregateFilter = {
	and?: InputMaybe<Array<TenantAggregateFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	logo?: InputMaybe<StringFieldComparison>;
	name?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<TenantAggregateFilter>>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type TenantAggregateGroupBy = {
	__typename?: 'TenantAggregateGroupBy';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	logo?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};


export type TenantAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type TenantAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type TenantAggregateResponse = {
	__typename?: 'TenantAggregateResponse';
	count?: Maybe<TenantCountAggregate>;
	groupBy?: Maybe<TenantAggregateGroupBy>;
	max?: Maybe<TenantMaxAggregate>;
	min?: Maybe<TenantMinAggregate>;
};

export type TenantApiKey = {
	__typename?: 'TenantApiKey';
	apiKey: Scalars['String']['output'];
	apiSecret: Scalars['String']['output'];
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	openAiOrganizationId?: Maybe<Scalars['String']['output']>;
	openAiSecretKey?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TenantApiKeyConnection = {
	__typename?: 'TenantApiKeyConnection';
	/** Array of edges. */
	edges: Array<TenantApiKeyEdge>;
	/** Paging information */
	pageInfo: PageInfo;
};

export type TenantApiKeyEdge = {
	__typename?: 'TenantApiKeyEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the TenantApiKey */
	node: TenantApiKey;
};

export type TenantApiKeyFilter = {
	and?: InputMaybe<Array<TenantApiKeyFilter>>;
	apiKey?: InputMaybe<StringFieldComparison>;
	apiSecret?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	openAiOrganizationId?: InputMaybe<StringFieldComparison>;
	openAiSecretKey?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<TenantApiKeyFilter>>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type TenantApiKeyInput = {
	apiKey: Scalars['String']['input'];
	apiSecret: Scalars['String']['input'];
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	openAiOrganizationId?: InputMaybe<Scalars['String']['input']>;
	openAiSecretKey?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type TenantApiKeySort = {
	direction: SortDirection;
	field: TenantApiKeySortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum TenantApiKeySortFields {
	ApiKey = 'apiKey',
	ApiSecret = 'apiSecret',
	CreatedAt = 'createdAt',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	OpenAiOrganizationId = 'openAiOrganizationId',
	OpenAiSecretKey = 'openAiSecretKey',
	UpdatedAt = 'updatedAt'
}

export type TenantApiKeyUpdateFilter = {
	and?: InputMaybe<Array<TenantApiKeyUpdateFilter>>;
	apiKey?: InputMaybe<StringFieldComparison>;
	apiSecret?: InputMaybe<StringFieldComparison>;
	createdAt?: InputMaybe<DateFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	openAiOrganizationId?: InputMaybe<StringFieldComparison>;
	openAiSecretKey?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<TenantApiKeyUpdateFilter>>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type TenantConnection = {
	__typename?: 'TenantConnection';
	/** Array of edges. */
	edges: Array<TenantEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type TenantCountAggregate = {
	__typename?: 'TenantCountAggregate';
	createdAt?: Maybe<Scalars['Int']['output']>;
	externalTenantId?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	logo?: Maybe<Scalars['Int']['output']>;
	name?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type TenantEdge = {
	__typename?: 'TenantEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the Tenant */
	node: Tenant;
};

export type TenantFilter = {
	and?: InputMaybe<Array<TenantFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	logo?: InputMaybe<StringFieldComparison>;
	name?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<TenantFilter>>;
	updatedAt?: InputMaybe<DateFieldComparison>;
};

export type TenantInput = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	logo?: InputMaybe<Scalars['String']['input']>;
	name: Scalars['String']['input'];
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type TenantMaxAggregate = {
	__typename?: 'TenantMaxAggregate';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	logo?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TenantMinAggregate = {
	__typename?: 'TenantMinAggregate';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	logo?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TenantSort = {
	direction: SortDirection;
	field: TenantSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum TenantSortFields {
	CreatedAt = 'createdAt',
	ExternalTenantId = 'externalTenantId',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	Logo = 'logo',
	Name = 'name',
	UpdatedAt = 'updatedAt'
}

export type UpdateAutomationTask = {
	command?: InputMaybe<Scalars['String']['input']>;
	commandResult?: InputMaybe<Scalars['String']['input']>;
	commandType?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId?: InputMaybe<Scalars['String']['input']>;
	employeeJobPostId?: InputMaybe<Scalars['String']['input']>;
	executedByEmployeeId?: InputMaybe<Scalars['String']['input']>;
	executedDate?: InputMaybe<Scalars['DateTime']['input']>;
	executionTime?: InputMaybe<Scalars['Float']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	isBroadcast?: InputMaybe<Scalars['Boolean']['input']>;
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId?: InputMaybe<Scalars['String']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	providerCode?: InputMaybe<Scalars['String']['input']>;
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	status?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateEmployee = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	externalEmployeeId?: InputMaybe<Scalars['String']['input']>;
	externalOrgId?: InputMaybe<Scalars['String']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	firstName?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	lastName?: InputMaybe<Scalars['String']['input']>;
	linkedInId?: InputMaybe<Scalars['String']['input']>;
	name?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	upworkId?: InputMaybe<Scalars['String']['input']>;
	upworkOrganizationId?: InputMaybe<Scalars['String']['input']>;
	upworkOrganizationName?: InputMaybe<Scalars['String']['input']>;
	userId?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateEmployeeJobApplication = {
	appliedDate?: InputMaybe<Scalars['DateTime']['input']>;
	appliedStatus?: InputMaybe<Scalars['String']['input']>;
	attachments?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId?: InputMaybe<Scalars['String']['input']>;
	employeeJobPostId?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	isProposalGeneratedByAI?: InputMaybe<Scalars['Boolean']['input']>;
	isViewedByClient?: InputMaybe<Scalars['Boolean']['input']>;
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId?: InputMaybe<Scalars['String']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	proposal?: InputMaybe<Scalars['String']['input']>;
	proposalTemplate?: InputMaybe<Scalars['String']['input']>;
	providerCode?: InputMaybe<Scalars['String']['input']>;
	providerJobApplicationId?: InputMaybe<Scalars['String']['input']>;
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	qa?: InputMaybe<Scalars['String']['input']>;
	rate?: InputMaybe<Scalars['Float']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	terms?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateEmployeeJobPost = {
	appliedDate?: InputMaybe<Scalars['DateTime']['input']>;
	appliedStatus?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isApplied?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobPostId?: InputMaybe<Scalars['String']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	providerCode?: InputMaybe<Scalars['String']['input']>;
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateJobPost = {
	budget?: InputMaybe<Scalars['String']['input']>;
	category?: InputMaybe<Scalars['String']['input']>;
	clientFeedback?: InputMaybe<Scalars['String']['input']>;
	clientJobsPosted?: InputMaybe<Scalars['Float']['input']>;
	clientPastHires?: InputMaybe<Scalars['Float']['input']>;
	clientPaymentVerificationStatus?: InputMaybe<Scalars['Boolean']['input']>;
	clientReviewsCount?: InputMaybe<Scalars['Float']['input']>;
	contractToHire?: InputMaybe<Scalars['Boolean']['input']>;
	country?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	description?: InputMaybe<Scalars['String']['input']>;
	duration?: InputMaybe<Scalars['String']['input']>;
	englishLevel?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	interviewingCount?: InputMaybe<Scalars['Float']['input']>;
	invitesSentCount?: InputMaybe<Scalars['Float']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	jobDateCreated?: InputMaybe<Scalars['DateTime']['input']>;
	jobStatus?: InputMaybe<Scalars['String']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	languages?: InputMaybe<Scalars['String']['input']>;
	proposalsCount?: InputMaybe<Scalars['Float']['input']>;
	providerCode?: InputMaybe<Scalars['String']['input']>;
	providerJobId?: InputMaybe<Scalars['String']['input']>;
	searchCategory?: InputMaybe<Scalars['String']['input']>;
	searchCategoryId?: InputMaybe<Scalars['String']['input']>;
	searchJobType?: InputMaybe<Scalars['String']['input']>;
	searchKeyword?: InputMaybe<Scalars['String']['input']>;
	searchOccupation?: InputMaybe<Scalars['String']['input']>;
	searchOccupationId?: InputMaybe<Scalars['String']['input']>;
	skills?: InputMaybe<Scalars['String']['input']>;
	subcategory?: InputMaybe<Scalars['String']['input']>;
	title?: InputMaybe<Scalars['String']['input']>;
	unansweredInvitesCount?: InputMaybe<Scalars['Float']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	url?: InputMaybe<Scalars['String']['input']>;
	workload?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateManyAutomationTasksInput = {
	/** Filter used to find fields to update */
	filter: AutomationTaskUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateAutomationTask;
};

export type UpdateManyEmployeeJobApplicationsInput = {
	/** Filter used to find fields to update */
	filter: EmployeeJobApplicationUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateEmployeeJobApplication;
};

export type UpdateManyEmployeeJobPostsInput = {
	/** Filter used to find fields to update */
	filter: EmployeeJobPostUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateEmployeeJobPost;
};

export type UpdateManyEmployeesInput = {
	/** Filter used to find fields to update */
	filter: EmployeeUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateEmployee;
};

export type UpdateManyJobPostsInput = {
	/** Filter used to find fields to update */
	filter: JobPostUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateJobPost;
};

export type UpdateManyResponse = {
	__typename?: 'UpdateManyResponse';
	/** The number of records updated. */
	updatedCount: Scalars['Int']['output'];
};

export type UpdateManyTenantApiKeysInput = {
	/** Filter used to find fields to update */
	filter: TenantApiKeyUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateTenantApiKey;
};

export type UpdateManyUpworkJobsSearchCriteriaInput = {
	/** Filter used to find fields to update */
	filter: UpworkJobsSearchCriterionUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateUpworkJobsSearchCriterion;
};

export type UpdateManyUsersInput = {
	/** Filter used to find fields to update */
	filter: UserUpdateFilter;
	/** The update to apply to all records found using the filter */
	update: UpdateUser;
};

export type UpdateOneAutomationTaskInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateAutomationTask;
};

export type UpdateOneAutomationTaskSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: AutomationTaskSubscriptionFilter;
};

export type UpdateOneEmployeeInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateEmployee;
};

export type UpdateOneEmployeeJobApplicationInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateEmployeeJobApplication;
};

export type UpdateOneEmployeeJobApplicationSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobApplicationSubscriptionFilter;
};

export type UpdateOneEmployeeJobPostInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateEmployeeJobPost;
};

export type UpdateOneEmployeeJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeJobPostSubscriptionFilter;
};

export type UpdateOneEmployeeSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: EmployeeSubscriptionFilter;
};

export type UpdateOneJobPostInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateJobPost;
};

export type UpdateOneJobPostSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: JobPostSubscriptionFilter;
};

export type UpdateOneTenantApiKeyInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateTenantApiKey;
};

export type UpdateOneUpworkJobsSearchCriterionInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateUpworkJobsSearchCriterion;
};

export type UpdateOneUpworkJobsSearchCriterionSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UpworkJobsSearchCriterionSubscriptionFilter;
};

export type UpdateOneUserInput = {
	/** The id of the record to update */
	id: Scalars['ID']['input'];
	/** The update to apply. */
	update: UpdateUser;
};

export type UpdateOneUserSubscriptionFilterInput = {
	/** Specify to filter the records returned. */
	filter: UserSubscriptionFilter;
};

export type UpdateTenantApiKey = {
	apiKey?: InputMaybe<Scalars['String']['input']>;
	apiSecret?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	openAiOrganizationId?: InputMaybe<Scalars['String']['input']>;
	openAiSecretKey?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateUpworkJobsSearchCriterion = {
	category?: InputMaybe<Scalars['String']['input']>;
	categoryId?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	jobType?: InputMaybe<Scalars['String']['input']>;
	keyword?: InputMaybe<Scalars['String']['input']>;
	occupation?: InputMaybe<Scalars['String']['input']>;
	occupationId?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateUser = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	email?: InputMaybe<Scalars['String']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	externalUserId?: InputMaybe<Scalars['String']['input']>;
	firstName?: InputMaybe<Scalars['String']['input']>;
	hash?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive?: InputMaybe<Scalars['Boolean']['input']>;
	isArchived?: InputMaybe<Scalars['Boolean']['input']>;
	lastName?: InputMaybe<Scalars['String']['input']>;
	name?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	username?: InputMaybe<Scalars['String']['input']>;
};

export type UpworkJobsSearchCriterion = {
	__typename?: 'UpworkJobsSearchCriterion';
	category?: Maybe<Scalars['String']['output']>;
	categoryId?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId: Scalars['String']['output'];
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	jobType: Scalars['String']['output'];
	keyword: Scalars['String']['output'];
	occupation?: Maybe<Scalars['String']['output']>;
	occupationId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type UpworkJobsSearchCriterionAggregateFilter = {
	and?: InputMaybe<Array<UpworkJobsSearchCriterionAggregateFilter>>;
	category?: InputMaybe<StringFieldComparison>;
	categoryId?: InputMaybe<StringFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	occupation?: InputMaybe<StringFieldComparison>;
	occupationId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UpworkJobsSearchCriterionAggregateFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
};

export type UpworkJobsSearchCriterionAggregateGroupBy = {
	__typename?: 'UpworkJobsSearchCriterionAggregateGroupBy';
	category?: Maybe<Scalars['String']['output']>;
	categoryId?: Maybe<Scalars['String']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	occupation?: Maybe<Scalars['String']['output']>;
	occupationId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
};

export type UpworkJobsSearchCriterionAggregateResponse = {
	__typename?: 'UpworkJobsSearchCriterionAggregateResponse';
	count?: Maybe<UpworkJobsSearchCriterionCountAggregate>;
	groupBy?: Maybe<UpworkJobsSearchCriterionAggregateGroupBy>;
	max?: Maybe<UpworkJobsSearchCriterionMaxAggregate>;
	min?: Maybe<UpworkJobsSearchCriterionMinAggregate>;
};

export type UpworkJobsSearchCriterionConnection = {
	__typename?: 'UpworkJobsSearchCriterionConnection';
	/** Array of edges. */
	edges: Array<UpworkJobsSearchCriterionEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type UpworkJobsSearchCriterionCountAggregate = {
	__typename?: 'UpworkJobsSearchCriterionCountAggregate';
	category?: Maybe<Scalars['Int']['output']>;
	categoryId?: Maybe<Scalars['Int']['output']>;
	employeeId?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	jobType?: Maybe<Scalars['Int']['output']>;
	occupation?: Maybe<Scalars['Int']['output']>;
	occupationId?: Maybe<Scalars['Int']['output']>;
	tenantId?: Maybe<Scalars['Int']['output']>;
};

export type UpworkJobsSearchCriterionDeleteFilter = {
	and?: InputMaybe<Array<UpworkJobsSearchCriterionDeleteFilter>>;
	category?: InputMaybe<StringFieldComparison>;
	categoryId?: InputMaybe<StringFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	occupation?: InputMaybe<StringFieldComparison>;
	occupationId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UpworkJobsSearchCriterionDeleteFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
};

export type UpworkJobsSearchCriterionDeleteResponse = {
	__typename?: 'UpworkJobsSearchCriterionDeleteResponse';
	category?: Maybe<Scalars['String']['output']>;
	categoryId?: Maybe<Scalars['String']['output']>;
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	keyword?: Maybe<Scalars['String']['output']>;
	occupation?: Maybe<Scalars['String']['output']>;
	occupationId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type UpworkJobsSearchCriterionEdge = {
	__typename?: 'UpworkJobsSearchCriterionEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the UpworkJobsSearchCriterion */
	node: UpworkJobsSearchCriterion;
};

export type UpworkJobsSearchCriterionFilter = {
	and?: InputMaybe<Array<UpworkJobsSearchCriterionFilter>>;
	category?: InputMaybe<StringFieldComparison>;
	categoryId?: InputMaybe<StringFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	occupation?: InputMaybe<StringFieldComparison>;
	occupationId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UpworkJobsSearchCriterionFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
};

export type UpworkJobsSearchCriterionInput = {
	category?: InputMaybe<Scalars['String']['input']>;
	categoryId?: InputMaybe<Scalars['String']['input']>;
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	employeeId: Scalars['String']['input'];
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	jobType: Scalars['String']['input'];
	keyword: Scalars['String']['input'];
	occupation?: InputMaybe<Scalars['String']['input']>;
	occupationId?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpworkJobsSearchCriterionMaxAggregate = {
	__typename?: 'UpworkJobsSearchCriterionMaxAggregate';
	category?: Maybe<Scalars['String']['output']>;
	categoryId?: Maybe<Scalars['String']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	occupation?: Maybe<Scalars['String']['output']>;
	occupationId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
};

export type UpworkJobsSearchCriterionMinAggregate = {
	__typename?: 'UpworkJobsSearchCriterionMinAggregate';
	category?: Maybe<Scalars['String']['output']>;
	categoryId?: Maybe<Scalars['String']['output']>;
	employeeId?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	jobType?: Maybe<Scalars['String']['output']>;
	occupation?: Maybe<Scalars['String']['output']>;
	occupationId?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
};

export type UpworkJobsSearchCriterionSort = {
	direction: SortDirection;
	field: UpworkJobsSearchCriterionSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum UpworkJobsSearchCriterionSortFields {
	Category = 'category',
	CategoryId = 'categoryId',
	EmployeeId = 'employeeId',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	JobType = 'jobType',
	Occupation = 'occupation',
	OccupationId = 'occupationId',
	TenantId = 'tenantId'
}

export type UpworkJobsSearchCriterionSubscriptionFilter = {
	and?: InputMaybe<Array<UpworkJobsSearchCriterionSubscriptionFilter>>;
	category?: InputMaybe<StringFieldComparison>;
	categoryId?: InputMaybe<StringFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	occupation?: InputMaybe<StringFieldComparison>;
	occupationId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UpworkJobsSearchCriterionSubscriptionFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
};

export type UpworkJobsSearchCriterionUpdateFilter = {
	and?: InputMaybe<Array<UpworkJobsSearchCriterionUpdateFilter>>;
	category?: InputMaybe<StringFieldComparison>;
	categoryId?: InputMaybe<StringFieldComparison>;
	employeeId?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	jobType?: InputMaybe<StringFieldComparison>;
	occupation?: InputMaybe<StringFieldComparison>;
	occupationId?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UpworkJobsSearchCriterionUpdateFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
};

export type User = {
	__typename?: 'User';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	email?: Maybe<Scalars['String']['output']>;
	employee?: Maybe<Employee>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	externalUserId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	hash?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive: Scalars['Boolean']['output'];
	isArchived: Scalars['Boolean']['output'];
	lastName?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	username?: Maybe<Scalars['String']['output']>;
};

export type UserAggregateFilter = {
	and?: InputMaybe<Array<UserAggregateFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	email?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	externalUserId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	hash?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UserAggregateFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	username?: InputMaybe<StringFieldComparison>;
};

export type UserAggregateGroupBy = {
	__typename?: 'UserAggregateGroupBy';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	email?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	externalUserId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	hash?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	username?: Maybe<Scalars['String']['output']>;
};


export type UserAggregateGroupByCreatedAtArgs = {
	by?: GroupBy;
};


export type UserAggregateGroupByUpdatedAtArgs = {
	by?: GroupBy;
};

export type UserAggregateResponse = {
	__typename?: 'UserAggregateResponse';
	count?: Maybe<UserCountAggregate>;
	groupBy?: Maybe<UserAggregateGroupBy>;
	max?: Maybe<UserMaxAggregate>;
	min?: Maybe<UserMinAggregate>;
};

export type UserConnection = {
	__typename?: 'UserConnection';
	/** Array of edges. */
	edges: Array<UserEdge>;
	/** Paging information */
	pageInfo: PageInfo;
	/** Fetch total count of records */
	totalCount: Scalars['Int']['output'];
};

export type UserCountAggregate = {
	__typename?: 'UserCountAggregate';
	createdAt?: Maybe<Scalars['Int']['output']>;
	email?: Maybe<Scalars['Int']['output']>;
	externalTenantId?: Maybe<Scalars['Int']['output']>;
	externalUserId?: Maybe<Scalars['Int']['output']>;
	firstName?: Maybe<Scalars['Int']['output']>;
	hash?: Maybe<Scalars['Int']['output']>;
	id?: Maybe<Scalars['Int']['output']>;
	isActive?: Maybe<Scalars['Int']['output']>;
	isArchived?: Maybe<Scalars['Int']['output']>;
	lastName?: Maybe<Scalars['Int']['output']>;
	tenantId?: Maybe<Scalars['Int']['output']>;
	updatedAt?: Maybe<Scalars['Int']['output']>;
	username?: Maybe<Scalars['Int']['output']>;
};

export type UserDeleteFilter = {
	and?: InputMaybe<Array<UserDeleteFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	email?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	externalUserId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	hash?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UserDeleteFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	username?: InputMaybe<StringFieldComparison>;
};

export type UserDeleteResponse = {
	__typename?: 'UserDeleteResponse';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	email?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	externalUserId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	hash?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	isActive?: Maybe<Scalars['Boolean']['output']>;
	isArchived?: Maybe<Scalars['Boolean']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	name?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	username?: Maybe<Scalars['String']['output']>;
};

export type UserEdge = {
	__typename?: 'UserEdge';
	/** Cursor for this node. */
	cursor: Scalars['ConnectionCursor']['output'];
	/** The node containing the User */
	node: User;
};

export type UserFilter = {
	and?: InputMaybe<Array<UserFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	email?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	externalUserId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	hash?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UserFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	username?: InputMaybe<StringFieldComparison>;
};

export type UserInput = {
	createdAt?: InputMaybe<Scalars['DateTime']['input']>;
	email?: InputMaybe<Scalars['String']['input']>;
	externalTenantId?: InputMaybe<Scalars['String']['input']>;
	externalUserId?: InputMaybe<Scalars['String']['input']>;
	firstName?: InputMaybe<Scalars['String']['input']>;
	hash?: InputMaybe<Scalars['String']['input']>;
	id?: InputMaybe<Scalars['ID']['input']>;
	isActive: Scalars['Boolean']['input'];
	isArchived: Scalars['Boolean']['input'];
	lastName?: InputMaybe<Scalars['String']['input']>;
	name?: InputMaybe<Scalars['String']['input']>;
	tenantId?: InputMaybe<Scalars['String']['input']>;
	updatedAt?: InputMaybe<Scalars['DateTime']['input']>;
	username?: InputMaybe<Scalars['String']['input']>;
};

export type UserMaxAggregate = {
	__typename?: 'UserMaxAggregate';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	email?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	externalUserId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	hash?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	username?: Maybe<Scalars['String']['output']>;
};

export type UserMinAggregate = {
	__typename?: 'UserMinAggregate';
	createdAt?: Maybe<Scalars['DateTime']['output']>;
	email?: Maybe<Scalars['String']['output']>;
	externalTenantId?: Maybe<Scalars['String']['output']>;
	externalUserId?: Maybe<Scalars['String']['output']>;
	firstName?: Maybe<Scalars['String']['output']>;
	hash?: Maybe<Scalars['String']['output']>;
	id?: Maybe<Scalars['ID']['output']>;
	lastName?: Maybe<Scalars['String']['output']>;
	tenantId?: Maybe<Scalars['String']['output']>;
	updatedAt?: Maybe<Scalars['DateTime']['output']>;
	username?: Maybe<Scalars['String']['output']>;
};

export type UserSort = {
	direction: SortDirection;
	field: UserSortFields;
	nulls?: InputMaybe<SortNulls>;
};

export enum UserSortFields {
	CreatedAt = 'createdAt',
	Email = 'email',
	ExternalTenantId = 'externalTenantId',
	ExternalUserId = 'externalUserId',
	FirstName = 'firstName',
	Hash = 'hash',
	Id = 'id',
	IsActive = 'isActive',
	IsArchived = 'isArchived',
	LastName = 'lastName',
	TenantId = 'tenantId',
	UpdatedAt = 'updatedAt',
	Username = 'username'
}

export type UserSubscriptionFilter = {
	and?: InputMaybe<Array<UserSubscriptionFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	email?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	externalUserId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	hash?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UserSubscriptionFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	username?: InputMaybe<StringFieldComparison>;
};

export type UserUpdateFilter = {
	and?: InputMaybe<Array<UserUpdateFilter>>;
	createdAt?: InputMaybe<DateFieldComparison>;
	email?: InputMaybe<StringFieldComparison>;
	externalTenantId?: InputMaybe<StringFieldComparison>;
	externalUserId?: InputMaybe<StringFieldComparison>;
	firstName?: InputMaybe<StringFieldComparison>;
	hash?: InputMaybe<StringFieldComparison>;
	id?: InputMaybe<IdFilterComparison>;
	isActive?: InputMaybe<BooleanFieldComparison>;
	isArchived?: InputMaybe<BooleanFieldComparison>;
	lastName?: InputMaybe<StringFieldComparison>;
	or?: InputMaybe<Array<UserUpdateFilter>>;
	tenantId?: InputMaybe<StringFieldComparison>;
	updatedAt?: InputMaybe<DateFieldComparison>;
	username?: InputMaybe<StringFieldComparison>;
};

export type EmployeeJobPostsQueryVariables = Exact<{
	after: Scalars['ConnectionCursor']['input'];
	first: Scalars['Int']['input'];
	filter: EmployeeJobPostFilter;
	sorting?: InputMaybe<Array<EmployeeJobPostSort> | EmployeeJobPostSort>;
}>;


export type EmployeeJobPostsQuery = { __typename?: 'Query', employeeJobPosts: { __typename?: 'EmployeeJobPostConnection', totalCount: number, pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, hasPreviousPage?: boolean | null, startCursor?: any | null, endCursor?: any | null }, edges: Array<{ __typename?: 'EmployeeJobPostEdge', node: { __typename?: 'EmployeeJobPost', id?: string | null, isApplied?: boolean | null, appliedDate?: any | null, createdAt?: any | null, updatedAt?: any | null, isActive: boolean, isArchived: boolean, employeeId: string, providerCode: string, providerJobId?: string | null, jobDateCreated?: any | null, jobStatus?: string | null, jobType?: string | null, jobPostId?: string | null, employee?: { __typename?: 'Employee', id?: string | null, externalEmployeeId?: string | null } | null, jobPost?: { __typename?: 'JobPost', id?: string | null, providerCode: string, providerJobId?: string | null, title: string, description: string, jobDateCreated?: any | null, jobStatus?: string | null, jobType?: string | null, url?: string | null, budget?: string | null, duration?: string | null, workload?: string | null, skills?: string | null, category?: string | null, subcategory?: string | null, country?: string | null, clientFeedback?: string | null, clientReviewsCount?: number | null, clientJobsPosted?: number | null, clientPastHires?: number | null, clientPaymentVerificationStatus?: boolean | null } | null } }> } };

export type EmployeeJobPostsByEmployeeIdJobPostIdQueryVariables = Exact<{
	employeeIdFilter: Scalars['String']['input'];
	jobPostIdFilter: Scalars['String']['input'];
}>;


export type EmployeeJobPostsByEmployeeIdJobPostIdQuery = { __typename?: 'Query', employeeJobPosts: { __typename?: 'EmployeeJobPostConnection', edges: Array<{ __typename?: 'EmployeeJobPostEdge', node: { __typename?: 'EmployeeJobPost', id?: string | null, isActive: boolean, isArchived: boolean } }> } };

export type EmployeeQueryVariables = Exact<{ [key: string]: never; }>;


export type EmployeeQuery = { __typename?: 'Query', employees: { __typename?: 'EmployeeConnection', pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, hasPreviousPage?: boolean | null, startCursor?: any | null, endCursor?: any | null }, edges: Array<{ __typename?: 'EmployeeEdge', node: { __typename?: 'Employee', id?: string | null, externalEmployeeId?: string | null, firstName?: string | null, lastName?: string | null } }> } };

export type EmployeeByExternalEmployeeIdQueryVariables = Exact<{
	externalEmployeeIdFilter: Scalars['String']['input'];
}>;


export type EmployeeByExternalEmployeeIdQuery = { __typename?: 'Query', employees: { __typename?: 'EmployeeConnection', totalCount: number, edges: Array<{ __typename?: 'EmployeeEdge', node: { __typename?: 'Employee', id?: string | null, externalEmployeeId?: string | null } }> } };

export type EmployeeByNameQueryVariables = Exact<{
	firstNameFilter: Scalars['String']['input'];
	lastNameFilter: Scalars['String']['input'];
}>;


export type EmployeeByNameQuery = { __typename?: 'Query', employees: { __typename?: 'EmployeeConnection', totalCount: number, edges: Array<{ __typename?: 'EmployeeEdge', node: { __typename?: 'Employee', id?: string | null, firstName?: string | null, lastName?: string | null, externalEmployeeId?: string | null } }> } };

export type UpdateOneEmployeeMutationVariables = Exact<{
	input: UpdateOneEmployeeInput;
}>;


export type UpdateOneEmployeeMutation = { __typename?: 'Mutation', updateOneEmployee: { __typename?: 'Employee', externalEmployeeId?: string | null, isActive: boolean, isArchived: boolean, firstName?: string | null, lastName?: string | null } };

export type UpdateOneEmployeeJobPostMutationVariables = Exact<{
	input: UpdateOneEmployeeJobPostInput;
}>;


export type UpdateOneEmployeeJobPostMutation = { __typename?: 'Mutation', updateOneEmployeeJobPost: { __typename?: 'EmployeeJobPost', employeeId: string, jobPostId?: string | null, isActive: boolean, isArchived: boolean, isApplied?: boolean | null, appliedDate?: any | null } };

export type DeleteManyUpworkJobsSearchCriteriaMutationVariables = Exact<{
	input: DeleteManyUpworkJobsSearchCriteriaInput;
}>;


export type DeleteManyUpworkJobsSearchCriteriaMutation = { __typename?: 'Mutation', deleteManyUpworkJobsSearchCriteria: { __typename?: 'DeleteManyResponse', deletedCount: number } };

export type CreateManyUpworkJobsSearchCriteriaMutationVariables = Exact<{
	input: CreateManyUpworkJobsSearchCriteriaInput;
}>;


export type CreateManyUpworkJobsSearchCriteriaMutation = { __typename?: 'Mutation', createManyUpworkJobsSearchCriteria: Array<{ __typename?: 'UpworkJobsSearchCriterion', id?: string | null }> };

export type JobPostsQueryVariables = Exact<{
	providerCodeFilter: Scalars['String']['input'];
	providerJobIdFilter: Scalars['String']['input'];
}>;


export type JobPostsQuery = { __typename?: 'Query', jobPosts: { __typename?: 'JobPostConnection', edges: Array<{ __typename?: 'JobPostEdge', node: { __typename?: 'JobPost', id?: string | null, isActive: boolean, isArchived: boolean } }> } };

export type TenantByExternalTenantIdQueryVariables = Exact<{
	externalTenantFilter: Scalars['String']['input'];
}>;


export type TenantByExternalTenantIdQuery = { __typename?: 'Query', tenants: { __typename?: 'TenantConnection', totalCount: number, edges: Array<{ __typename?: 'TenantEdge', node: { __typename?: 'Tenant', id?: string | null, name: string, externalTenantId?: string | null } }> } };


export const EmployeeJobPostsDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "employeeJobPosts" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "after" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "ConnectionCursor" } } } }, { "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "first" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "Int" } } } }, { "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "filter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "EmployeeJobPostFilter" } } } }, { "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "sorting" } }, "type": { "kind": "ListType", "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "EmployeeJobPostSort" } } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "employeeJobPosts" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "paging" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "after" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "after" } } }, { "kind": "ObjectField", "name": { "kind": "Name", "value": "first" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "first" } } }] } }, { "kind": "Argument", "name": { "kind": "Name", "value": "filter" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "filter" } } }, { "kind": "Argument", "name": { "kind": "Name", "value": "sorting" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "sorting" } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "totalCount" } }, { "kind": "Field", "name": { "kind": "Name", "value": "pageInfo" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "hasNextPage" } }, { "kind": "Field", "name": { "kind": "Name", "value": "hasPreviousPage" } }, { "kind": "Field", "name": { "kind": "Name", "value": "startCursor" } }, { "kind": "Field", "name": { "kind": "Name", "value": "endCursor" } }] } }, { "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isApplied" } }, { "kind": "Field", "name": { "kind": "Name", "value": "appliedDate" } }, { "kind": "Field", "name": { "kind": "Name", "value": "createdAt" } }, { "kind": "Field", "name": { "kind": "Name", "value": "updatedAt" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isActive" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isArchived" } }, { "kind": "Field", "name": { "kind": "Name", "value": "employeeId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "employee" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "externalEmployeeId" } }] } }, { "kind": "Field", "name": { "kind": "Name", "value": "providerCode" } }, { "kind": "Field", "name": { "kind": "Name", "value": "providerJobId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobDateCreated" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobStatus" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobType" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobPostId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobPost" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "providerCode" } }, { "kind": "Field", "name": { "kind": "Name", "value": "providerJobId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "title" } }, { "kind": "Field", "name": { "kind": "Name", "value": "description" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobDateCreated" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobStatus" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobType" } }, { "kind": "Field", "name": { "kind": "Name", "value": "url" } }, { "kind": "Field", "name": { "kind": "Name", "value": "budget" } }, { "kind": "Field", "name": { "kind": "Name", "value": "duration" } }, { "kind": "Field", "name": { "kind": "Name", "value": "workload" } }, { "kind": "Field", "name": { "kind": "Name", "value": "skills" } }, { "kind": "Field", "name": { "kind": "Name", "value": "category" } }, { "kind": "Field", "name": { "kind": "Name", "value": "subcategory" } }, { "kind": "Field", "name": { "kind": "Name", "value": "country" } }, { "kind": "Field", "name": { "kind": "Name", "value": "clientFeedback" } }, { "kind": "Field", "name": { "kind": "Name", "value": "clientReviewsCount" } }, { "kind": "Field", "name": { "kind": "Name", "value": "clientJobsPosted" } }, { "kind": "Field", "name": { "kind": "Name", "value": "clientPastHires" } }, { "kind": "Field", "name": { "kind": "Name", "value": "clientPaymentVerificationStatus" } }] } }] } }] } }] } }] } }] } as unknown as DocumentNode<EmployeeJobPostsQuery, EmployeeJobPostsQueryVariables>;
export const EmployeeJobPostsByEmployeeIdJobPostIdDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "employeeJobPostsByEmployeeIdJobPostId" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "employeeIdFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }, { "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "jobPostIdFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "employeeJobPosts" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "filter" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "employeeId" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "employeeIdFilter" } } }] } }, { "kind": "ObjectField", "name": { "kind": "Name", "value": "jobPostId" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "jobPostIdFilter" } } }] } }] } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isActive" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isArchived" } }] } }] } }] } }] } }] } as unknown as DocumentNode<EmployeeJobPostsByEmployeeIdJobPostIdQuery, EmployeeJobPostsByEmployeeIdJobPostIdQueryVariables>;
export const EmployeeDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "employee" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "employees" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "pageInfo" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "hasNextPage" } }, { "kind": "Field", "name": { "kind": "Name", "value": "hasPreviousPage" } }, { "kind": "Field", "name": { "kind": "Name", "value": "startCursor" } }, { "kind": "Field", "name": { "kind": "Name", "value": "endCursor" } }] } }, { "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "externalEmployeeId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "firstName" } }, { "kind": "Field", "name": { "kind": "Name", "value": "lastName" } }] } }] } }] } }] } }] } as unknown as DocumentNode<EmployeeQuery, EmployeeQueryVariables>;
export const EmployeeByExternalEmployeeIdDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "employeeByExternalEmployeeId" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "externalEmployeeIdFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "employees" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "filter" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "externalEmployeeId" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "externalEmployeeIdFilter" } } }] } }] } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "externalEmployeeId" } }] } }] } }, { "kind": "Field", "name": { "kind": "Name", "value": "totalCount" } }] } }] } }] } as unknown as DocumentNode<EmployeeByExternalEmployeeIdQuery, EmployeeByExternalEmployeeIdQueryVariables>;
export const EmployeeByNameDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "employeeByName" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "firstNameFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }, { "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "lastNameFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "employees" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "filter" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "firstName" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "firstNameFilter" } } }] } }, { "kind": "ObjectField", "name": { "kind": "Name", "value": "lastName" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "lastNameFilter" } } }] } }] } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "firstName" } }, { "kind": "Field", "name": { "kind": "Name", "value": "lastName" } }, { "kind": "Field", "name": { "kind": "Name", "value": "externalEmployeeId" } }] } }] } }, { "kind": "Field", "name": { "kind": "Name", "value": "totalCount" } }] } }] } }] } as unknown as DocumentNode<EmployeeByNameQuery, EmployeeByNameQueryVariables>;
export const UpdateOneEmployeeDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "mutation", "name": { "kind": "Name", "value": "updateOneEmployee" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "UpdateOneEmployeeInput" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "updateOneEmployee" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "input" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "externalEmployeeId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isActive" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isArchived" } }, { "kind": "Field", "name": { "kind": "Name", "value": "firstName" } }, { "kind": "Field", "name": { "kind": "Name", "value": "lastName" } }] } }] } }] } as unknown as DocumentNode<UpdateOneEmployeeMutation, UpdateOneEmployeeMutationVariables>;
export const UpdateOneEmployeeJobPostDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "mutation", "name": { "kind": "Name", "value": "updateOneEmployeeJobPost" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "UpdateOneEmployeeJobPostInput" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "updateOneEmployeeJobPost" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "input" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "employeeId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "jobPostId" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isActive" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isArchived" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isApplied" } }, { "kind": "Field", "name": { "kind": "Name", "value": "appliedDate" } }] } }] } }] } as unknown as DocumentNode<UpdateOneEmployeeJobPostMutation, UpdateOneEmployeeJobPostMutationVariables>;
export const DeleteManyUpworkJobsSearchCriteriaDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "mutation", "name": { "kind": "Name", "value": "deleteManyUpworkJobsSearchCriteria" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "DeleteManyUpworkJobsSearchCriteriaInput" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "deleteManyUpworkJobsSearchCriteria" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "input" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "deletedCount" } }] } }] } }] } as unknown as DocumentNode<DeleteManyUpworkJobsSearchCriteriaMutation, DeleteManyUpworkJobsSearchCriteriaMutationVariables>;
export const CreateManyUpworkJobsSearchCriteriaDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "mutation", "name": { "kind": "Name", "value": "createManyUpworkJobsSearchCriteria" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "CreateManyUpworkJobsSearchCriteriaInput" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "createManyUpworkJobsSearchCriteria" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "input" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "input" } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }] } }] } }] } as unknown as DocumentNode<CreateManyUpworkJobsSearchCriteriaMutation, CreateManyUpworkJobsSearchCriteriaMutationVariables>;
export const JobPostsDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "jobPosts" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "providerCodeFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }, { "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "providerJobIdFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "jobPosts" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "filter" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "providerCode" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "providerCodeFilter" } } }] } }, { "kind": "ObjectField", "name": { "kind": "Name", "value": "providerJobId" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "providerJobIdFilter" } } }] } }] } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isActive" } }, { "kind": "Field", "name": { "kind": "Name", "value": "isArchived" } }] } }] } }] } }] } }] } as unknown as DocumentNode<JobPostsQuery, JobPostsQueryVariables>;
export const TenantByExternalTenantIdDocument = { "kind": "Document", "definitions": [{ "kind": "OperationDefinition", "operation": "query", "name": { "kind": "Name", "value": "tenantByExternalTenantId" }, "variableDefinitions": [{ "kind": "VariableDefinition", "variable": { "kind": "Variable", "name": { "kind": "Name", "value": "externalTenantFilter" } }, "type": { "kind": "NonNullType", "type": { "kind": "NamedType", "name": { "kind": "Name", "value": "String" } } } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "tenants" }, "arguments": [{ "kind": "Argument", "name": { "kind": "Name", "value": "filter" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "externalTenantId" }, "value": { "kind": "ObjectValue", "fields": [{ "kind": "ObjectField", "name": { "kind": "Name", "value": "eq" }, "value": { "kind": "Variable", "name": { "kind": "Name", "value": "externalTenantFilter" } } }] } }] } }], "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "edges" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "node" }, "selectionSet": { "kind": "SelectionSet", "selections": [{ "kind": "Field", "name": { "kind": "Name", "value": "id" } }, { "kind": "Field", "name": { "kind": "Name", "value": "name" } }, { "kind": "Field", "name": { "kind": "Name", "value": "externalTenantId" } }] } }] } }, { "kind": "Field", "name": { "kind": "Name", "value": "totalCount" } }] } }] } }] } as unknown as DocumentNode<TenantByExternalTenantIdQuery, TenantByExternalTenantIdQueryVariables>;
