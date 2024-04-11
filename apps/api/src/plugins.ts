import { environment } from '@gauzy/config';
import { ChangelogPlugin } from '@gauzy/changelog-plugin';
import { JitsuAnalyticsPlugin } from '@gauzy/jitsu-analytics-plugin';
import { KnowledgeBasePlugin } from '@gauzy/knowledge-base-plugin';
import { JobSearchPlugin } from '@gauzy/job-search-plugin';
import { JobProposalTemplatePlugin } from '@gauzy/job-proposal-template-plugin';
import { SentryTracing as SentryPlugin } from './sentry';

const { jitsu, sentry } = environment;

/**
 * An array of plugins to be included or used in the codebase.
 */
export const plugins = [
    // Initializes the Jitsu Analytics Plugin by providing a configuration object.
    JitsuAnalyticsPlugin.init({
        config: {
            host: jitsu.serverHost,
            writeKey: jitsu.serverWriteKey,
            debug: jitsu.debug,
            echoEvents: jitsu.echoEvents
        }
    }),
    // Includes the SentryPlugin based on the presence of Sentry configuration.
    ...(sentry && sentry.dsn ? [SentryPlugin] : []),
    // Indicates the inclusion or intention to use the ChangelogPlugin in the codebase.
    ChangelogPlugin,
    // Indicates the inclusion or intention to use the KnowledgeBasePlugin in the codebase.
    KnowledgeBasePlugin,
    // Indicates the inclusion or intention to use the JobSearchPlugin in the codebase.
    JobSearchPlugin,
    // Indicates the inclusion or intention to use the JobSearchPlugin in the codebase.
    JobSearchPlugin,
    // Indicates the inclusion or intention to use the JobProposalTemplatePlugin in the codebase.
    JobProposalTemplatePlugin
];
