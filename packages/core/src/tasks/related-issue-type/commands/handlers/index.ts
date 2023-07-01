import { OrganizationProjectRelatedIssueTypeBulkCreateHandler } from './organization-project-related-issue-type-bulk-create.handler';
import { OrganizationRelatedIssueTypeBulkCreateHandler } from './organization-related-issue-type-bulk-create.handler';
import { OrganizationTeamTaskRelatedIssueTypeBulkCreateHandler } from './organization-team-task-related-issue-type-bulk-create.handle';

export const CommandHandlers = [
	OrganizationProjectRelatedIssueTypeBulkCreateHandler,
	OrganizationRelatedIssueTypeBulkCreateHandler,
	OrganizationTeamTaskRelatedIssueTypeBulkCreateHandler,
];
