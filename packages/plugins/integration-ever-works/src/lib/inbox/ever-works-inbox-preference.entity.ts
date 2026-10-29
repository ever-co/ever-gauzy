import { Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MikroOrmBaseEntityRepository,
	MultiORMColumn,
	MultiORMEntity,
	TenantOrganizationBaseEntity
} from '@gauzy/core';

/**
 * One person's choice of what of their Gauzy Inbox goes to Ever Works (owner decision 2026-10-29): per user and
 * tenant, the Ever Works inbox kinds they **exclude** (JSON `string[]`). No row, or an empty list, sends every kind:
 * everything is on by default, and a kind added later starts on as well. `organizationId` stays empty (the choice
 * holds in every mapped organization of the tenant). Unique on (`tenantId`, `userId`).
 */
@MultiORMEntity('ever_works_inbox_preference', { mikroOrmRepository: () => MikroOrmEverWorksInboxPreferenceRepository })
export class EverWorksInboxPreference extends TenantOrganizationBaseEntity {
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 36 })
	userId!: ID;

	/** JSON `EverWorksInboxKind[]`: the kinds this person keeps out of Ever Works. */
	@MultiORMColumn({ type: 'text', nullable: true })
	excludedKinds?: string | null;
}

@Injectable()
export class MikroOrmEverWorksInboxPreferenceRepository extends MikroOrmBaseEntityRepository<EverWorksInboxPreference> {}
