import { JobEmployeeModule } from '@gauzy/plugins/job-employee-ui';
import { JobMatchingModule } from '@gauzy/plugins/job-matching-ui';
import { JobSearchModule } from '@gauzy/plugins/job-search-ui';
import { JobProposalTemplateModule } from '@gauzy/plugins/job-proposal-ui';

/**
 * An array of plugins to be included or used in the codebase.
 */
export const PLUGINS = [
	// Indicates the inclusion or intention to use the JobEmployeeModule in the codebase.
	JobEmployeeModule,
	// Indicates the inclusion or intention to use the JobMatchingModule in the codebase.
	JobMatchingModule,
	// Indicates the inclusion or intention to use the JobSearchModule in the codebase.
	JobSearchModule,
	// Indicates the inclusion or intention to use the JobProposalTemplateModule in the codebase.
	JobProposalTemplateModule
];
