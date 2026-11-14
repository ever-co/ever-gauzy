import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** The MikroORM repository the entity names (the services run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmTaskAutomationLinkClosureRepository extends MikroOrmBaseEntityRepository<TaskAutomationLinkClosure> {}

/**
 * `task_automation_link_closure`: the closed links of tasks that became `task_link.closed` (spec T16). One row per task
 * and link, unique on `(tenantId, taskId, provider, kind, externalId)`: a close delivered again — the provider's
 * redelivery, another API instance, the same pull request closed again after a reopen — finds its row and appends
 * nothing. A merged pull request also has a row of kind `pull_request.merged` for its merge (spec FR-21), so a close
 * without merging never keeps its later merge from the rules that wait for one. `taskId` has no foreign key, as a
 * run's: the row outlives its task.
 */
@MultiORMEntity('task_automation_link_closure', { mikroOrmRepository: () => MikroOrmTaskAutomationLinkClosureRepository })
export class TaskAutomationLinkClosure extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	taskId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	provider!: string;

	@MultiORMColumn({ type: 'varchar', length: 24 })
	kind!: string;

	@MultiORMColumn({ type: 'varchar', length: 255 })
	externalId!: string;
}
