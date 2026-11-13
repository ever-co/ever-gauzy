/**
 * Public API Surface of @gauzy/plugin-integration-jira
 */
// The Connect app descriptor and its lifecycle routes (always loaded).
export * from './lib/integration-jira.plugin';
// The Jira Cloud sync (OAuth 2.0, mappings, imports, webhooks, outbound): loaded only when JIRA_ENABLED=true.
export * from './lib/integration-jira-cloud.plugin';
export * from './lib/jira-cloud.module';
export * from './lib/jira-enabled';
export * from './lib/jira-config';
export * from './lib/jira.constants';
export * from './lib/jira-catalog.service';
export * from './lib/client/jira-api.client';
export * from './lib/entities/jira-project-mapping.entity';
export * from './lib/entities/jira-sync-run.entity';
export * from './lib/sync/jira-adf';
