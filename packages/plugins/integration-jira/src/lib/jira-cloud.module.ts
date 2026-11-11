import { Logger, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
	EmployeeModule,
	IntegrationMapModule,
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	OrganizationProjectModule,
	PluginCommonModule,
	RolePermissionModule
} from '@gauzy/core';
import { JiraIssueBaseline, MikroOrmJiraIssueBaselineRepository, TypeOrmJiraIssueBaselineRepository } from './entities/jira-issue-baseline.entity';
import { JiraSyncConflict, MikroOrmJiraSyncConflictRepository, TypeOrmJiraSyncConflictRepository } from './entities/jira-sync-conflict.entity';
import { JiraSyncRun, MikroOrmJiraSyncRunRepository, TypeOrmJiraSyncRunRepository } from './entities/jira-sync-run.entity';
import { JiraProjectMapping, MikroOrmJiraProjectMappingRepository, TypeOrmJiraProjectMappingRepository } from './entities/jira-project-mapping.entity';
import { JiraAuthorizationController } from './jira-authorization.controller';
import { JiraCatalogService } from './jira-catalog.service';
import { readJiraConfig } from './jira-config';
import { JiraMappingService } from './jira-mapping.service';
import { JiraOAuthStateService } from './jira-oauth-state.service';
import { JiraSyncConflictService } from './jira-sync-conflict.service';
import { JiraSyncRunService } from './jira-sync-run.service';
import { JiraTenantService } from './jira-tenant.service';
import { JiraWebhookController } from './jira-webhook.controller';
import { JiraWebhookDedupeService } from './jira-webhook-dedupe.service';
import { JiraCloudController } from './jira-cloud.controller';
import { JIRA_CONFIG } from './jira.constants';
import { JiraLifecycle } from './jira.lifecycle';
import { JiraEventSubscriber } from './sync/jira-event.subscriber';
import { JiraSyncService } from './sync/jira-sync.service';
import { JiraIssueDetailsService } from './sync/jira-issue-details.service';
import { JiraImportSweepService } from './maintenance/jira-import-sweep.service';
import { JiraWebhookService } from './sync/jira-webhook.service';

/** Every table the plugin owns (its migration creates them). */
export const JIRA_ENTITIES = [JiraProjectMapping, JiraSyncRun, JiraSyncConflict, JiraIssueBaseline];

/**
 * The Jira Cloud sync module (`IntegrationJiraCloudPlugin` of `@gauzy/plugin-integration-jira`). Loaded only when `JIRA_ENABLED=true`
 * (see `isJiraEnabled`). Both ORMs are registered for every entity: the platform selects its ORM at
 * boot, and the paired repositories are providers so the same services run on either.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(JIRA_ENTITIES),
		MikroOrmModule.forFeature(JIRA_ENTITIES),
		// The tenant and permission guards of the management routes need the role permissions.
		RolePermissionModule,
		// The platform's event bus (TaskEvent) and command bus (the id-map sync commands).
		PluginCommonModule,
		CqrsModule,
		// The integration framework: the catalogue, the connected instance, its settings and id maps.
		IntegrationModule,
		IntegrationTenantModule,
		IntegrationSettingModule,
		IntegrationMapModule,
		// What the sync resolves: projects and employees by e-mail (statuses and priorities are read directly).
		OrganizationProjectModule,
		EmployeeModule
	],
	// The callback and the webhook before the id routes: registered after, `GET /callback` would be taken by
	// `GET /:integrationId` (and refused by its guard and its UUID check).
	controllers: [JiraAuthorizationController, JiraWebhookController, JiraCloudController],
	providers: [
		JiraCatalogService,
		JiraLifecycle,
		JiraOAuthStateService,
		JiraTenantService,
		JiraMappingService,
		JiraSyncRunService,
		JiraSyncConflictService,
		JiraSyncService,
		JiraIssueDetailsService,
		JiraImportSweepService,
		JiraWebhookService,
		JiraWebhookDedupeService,
		JiraEventSubscriber,
		TypeOrmJiraProjectMappingRepository,
		MikroOrmJiraProjectMappingRepository,
		TypeOrmJiraSyncRunRepository,
		MikroOrmJiraSyncRunRepository,
		TypeOrmJiraSyncConflictRepository,
		MikroOrmJiraSyncConflictRepository,
		TypeOrmJiraIssueBaselineRepository,
		MikroOrmJiraIssueBaselineRepository,
		{
			provide: JIRA_CONFIG,
			useFactory: () => {
				const logger = new Logger('Jira');
				return readJiraConfig(process.env, (message) => logger.warn(message));
			}
		}
	],
	exports: [JiraCatalogService, JiraTenantService, JiraMappingService, JiraSyncService, JiraWebhookService, JiraImportSweepService, JIRA_CONFIG]
})
export class JiraCloudModule {}
