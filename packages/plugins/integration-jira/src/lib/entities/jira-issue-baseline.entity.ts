import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JoinColumn, RelationId, Repository } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import {
	ColumnIndex,
	IntegrationTenant,
	MikroOrmBaseEntityRepository,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';

/**
 * What an issue and its task last agreed on: the synced fields as Jira sent them the last time the issue was
 * applied. The next apply compares the task and the issue with it, so a field changed on one side follows that
 * side, and one changed on both is a conflict. One row per issue of a connection.
 */
@MultiORMEntity('integration_jira_issue_baseline', { mikroOrmRepository: () => MikroOrmJiraIssueBaselineRepository })
export class JiraIssueBaseline extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((baseline: JiraIssueBaseline) => baseline.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The Jira issue's id. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	sourceId!: string;

	/** The task the issue is (a plain id). */
	@MultiORMColumn({ type: 'varchar', length: 36 })
	taskId!: ID;

	/** The agreed values (JSON: `title`, `description`, `status`, `priority`, `dueDate`). */
	@MultiORMColumn({ type: 'text' })
	syncedFields!: string;
}

@Injectable()
export class MikroOrmJiraIssueBaselineRepository extends MikroOrmBaseEntityRepository<JiraIssueBaseline> {}

@Injectable()
export class TypeOrmJiraIssueBaselineRepository extends Repository<JiraIssueBaseline> {
	constructor(@InjectRepository(JiraIssueBaseline) readonly repository: Repository<JiraIssueBaseline>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
