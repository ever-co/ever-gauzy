import { environment } from '@gauzy/config';

import { ChangelogPlugin } from '@gauzy/plugin-changelog';
import { IntegrationAIPlugin } from '@gauzy/plugin-integration-ai';
import { IntegrationGithubPlugin } from '@gauzy/plugin-integration-github';
import { IntegrationJiraPlugin } from '@gauzy/plugin-integration-jira';
import { IntegrationHubstaffPlugin } from '@gauzy/plugin-integration-hubstaff';
import { IntegrationMakeComPlugin } from '@gauzy/plugin-integration-make-com';
import { IntegrationZapierPlugin } from '@gauzy/plugin-integration-zapier';
import { IntegrationActivepiecesPlugin } from '@gauzy/plugin-integration-activepieces';
import { IntegrationUpworkPlugin } from '@gauzy/plugin-integration-upwork';
import { JitsuAnalyticsPlugin } from '@gauzy/plugin-jitsu-analytics';
import { JobProposalPlugin } from '@gauzy/plugin-job-proposal';
import { JobSearchPlugin } from '@gauzy/plugin-job-search';
import { KnowledgeBasePlugin } from '@gauzy/plugin-knowledge-base';
import { ProductReviewsPlugin } from '@gauzy/plugin-product-reviews';
import { VideosPlugin } from '@gauzy/plugin-videos';
import { RegistryPlugin } from '@gauzy/plugin-registry';
import { CamshotPlugin } from '@gauzy/plugin-camshot';

import { SentryTracing as SentryPlugin } from './sentry';
import { PosthogAnalytics as PosthogPlugin } from './posthog';
import { SoundshotPlugin } from '@gauzy/plugin-soundshot';

const { jitsu, sentry, posthog } = environment;

/**
 * An array of plugins to be included or used in the codebase.
 */
export const plugins = [
	// Includes the SentryPlugin based on the presence of Sentry configuration.
	...(sentry?.dsn ? [SentryPlugin] : []),

	// Includes the PostHogPlugin based on the presence of PostHog configuration.
	...(posthog?.posthogEnabled && posthog?.posthogKey ? [PosthogPlugin] : []),

	// Initializes the Jitsu Analytics Plugin by providing a configuration object.
	JitsuAnalyticsPlugin.init({
		config: {
			host: jitsu.serverHost,
			writeKey: jitsu.serverWriteKey,
			debug: jitsu.debug,
			echoEvents: jitsu.echoEvents
		}
	}),
	// Indicates the inclusion or intention to use the ChangelogPlugin in the codebase.
	ChangelogPlugin,
	// Indicates the inclusion or intention to use the IntegrationActivepiecesPlugin in the codebase.
	IntegrationActivepiecesPlugin,
	// Indicates the inclusion or intention to use the IntegrationAIPlugin in the codebase.
	IntegrationAIPlugin,
	// Indicates the inclusion or intention to use the IntegrationGithubPlugin in the codebase.
	IntegrationGithubPlugin,
	// Indicates the inclusion or intention to use the IntegrationHubstaffPlugin in the codebase.
	IntegrationHubstaffPlugin,
	// Indicates the inclusion or intention to use the IntegrationMakeComPlugin in the codebase.
	IntegrationMakeComPlugin,
	// Indicates the inclusion or intention to use the IntegrationJiraPlugin in the codebase.
	IntegrationJiraPlugin,
	// Indicates the inclusion or intention to use the IntegrationUpworkPlugin in the codebase.
	IntegrationUpworkPlugin,
	// Indicates the inclusion or intention to use the IntegrationZapierPlugin in the codebase.
	IntegrationZapierPlugin,
	// Indicates the inclusion or intention to use the JobProposalPlugin in the codebase.
	JobProposalPlugin,
	// Indicates the inclusion or intention to use the JobSearchPlugin in the codebase.
	JobSearchPlugin,
	// Indicates the inclusion or intention to use the KnowledgeBasePlugin in the codebase.
	KnowledgeBasePlugin,
	// Indicates the inclusion or intention to use the ProductReviewsPlugin in the codebase.
	ProductReviewsPlugin,
	// Indicates the inclusion or intention to use the VideosPlugin in the codebase.
	VideosPlugin,
	// Indicates the inclusion or intention to use the CamshotPlugin in the codebase.
	CamshotPlugin,
	// Indicates the inclusion or intention to use the SoundshotPlugin in the codebase.
	SoundshotPlugin,
	// Indicates the inclusion or intention to use the RegistryPlugin in the codebase.
	RegistryPlugin
];
