import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JoinColumn, RelationId, Repository } from 'typeorm';
import { ID, IIntegrationTenant, IOrganizationProject } from '@gauzy/contracts';
import {
	ColumnIndex,
	IntegrationTenant,
	MikroOrmBaseEntityRepository,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	OrganizationProject,
	TenantOrganizationBaseEntity
} from '@gauzy/core';

/** Which way changes flow for a mapping. */
export enum JiraSyncDirection {
	/** Jira issues become and update tasks; nothing goes back. */
	INBOUND = 'inbound',
	/** Tasks of the project are sent to Jira; nothing comes in. */
	OUTBOUND = 'outbound',
	BOTH = 'both'
}

/**
 * One Jira project mapped to one platform project of a connected organization: the direction, the status map (JSON:
 * a task status for each status category, and for the statuses named on their own), the issue types it takes (JSON,
 * all of them when empty), and where the last import stopped. A disconnect (the integration tenant goes) or a deleted
 * project takes its mappings with it.
 */
@MultiORMEntity('integration_jira_project_mapping', { mikroOrmRepository: () => MikroOrmJiraProjectMappingRepository })
export class JiraProjectMapping extends TenantOrganizationBaseEntity {
	/** The connected organization's integration tenant (`integration_tenant`, named `Jira`). */
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((mapping: JiraProjectMapping) => mapping.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The Jira project's id (digits; its key can be renamed, the id cannot). */
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	jiraProjectId!: string;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	jiraProjectKey?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	jiraProjectName?: string | null;

	/** The platform project the Jira project's issues become tasks of. */
	@MultiORMManyToOne(() => OrganizationProject, { onDelete: 'CASCADE' })
	@JoinColumn()
	project?: IOrganizationProject;

	@RelationId((mapping: JiraProjectMapping) => mapping.project)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	projectId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: JiraSyncDirection.INBOUND })
	direction!: JiraSyncDirection;

	/** JSON `Record<'new' | 'indeterminate' | 'done' | 'status:<id>', string>`: the task status of each category and named status. */
	@MultiORMColumn({ type: 'text', nullable: true })
	statusMap?: string | null;

	/** JSON `string[]`: the issue types imported (and the first one used for a task sent out); null for every type. */
	@MultiORMColumn({ type: 'text', nullable: true })
	issueTypeIds?: string | null;

	@MultiORMColumn({ type: 'boolean', default: true })
	syncEnabled!: boolean;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	lastImportedAt?: Date | null;

	/** Where the next incremental import starts: an ISO instant (the issues changed at or after it are read). */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	lastCursor?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmJiraProjectMappingRepository extends MikroOrmBaseEntityRepository<JiraProjectMapping> {}

@Injectable()
export class TypeOrmJiraProjectMappingRepository extends Repository<JiraProjectMapping> {
	constructor(@InjectRepository(JiraProjectMapping) readonly repository: Repository<JiraProjectMapping>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
