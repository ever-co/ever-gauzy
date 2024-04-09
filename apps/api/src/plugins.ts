import { environment } from '@gauzy/config';
import { ChangelogPlugin } from '@gauzy/changelog-plugin';
import { JitsuAnalyticsPlugin } from '@gauzy/jitsu-analytics-plugin';
import { KnowledgeBasePlugin } from '@gauzy/knowledge-base-plugin';
import { JobPostPlugin } from '@gauzy/job-post-plugin';
import { SentryTracing as SentryPlugin } from './sentry';

const { jitsu, sentry } = environment;

/**
 * An array of plugins to be included or used in the codebase.
 */
export const plugins = [
    // Indicates the inclusion or intention to use the JobPostPlugin in the codebase.
    JobPostPlugin,
    // Indicates the inclusion or intention to use the ChangelogPlugin in the codebase.
    ChangelogPlugin,
    // Indicates the inclusion or intention to use the KnowledgeBasePlugin in the codebase.
    KnowledgeBasePlugin,
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
];
