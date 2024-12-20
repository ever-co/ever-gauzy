import { OrganizationTeamIssueTypeBulkCreateHandler } from './organization-team-issue-type-bulk-create.handle';
import { TenantIssueTypeBulkCreateHandler } from './tenant-issue-type-bulk-create.handler';
import { OrganizationIssueTypeBulkCreateHandler } from './organization-issue-type-bulk-create.handler';
import { OrganizationProjectIssueTypeBulkCreateHandler } from './organization-project-issue-type-bulk-create.handler';

export const CommandHandlers = [
	OrganizationTeamIssueTypeBulkCreateHandler,
	TenantIssueTypeBulkCreateHandler,
	OrganizationIssueTypeBulkCreateHandler,
	OrganizationProjectIssueTypeBulkCreateHandler,
];
