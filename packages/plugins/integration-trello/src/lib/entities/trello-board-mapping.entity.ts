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
export enum TrelloSyncDirection {
	/** Trello cards become and update tasks; nothing goes back. */
	INBOUND = 'inbound',
	/** Tasks of the project are sent to Trello; nothing comes in. */
	OUTBOUND = 'outbound',
	BOTH = 'both'
}

/**
 * One Trello board mapped to one platform project of a connected organization: the direction, the list →
 * task-status map (JSON, by list id), the webhook Trello delivers the board's events to, and where the last import
 * stopped. A disconnect (the integration tenant goes) or a deleted project takes its mappings with it.
 */
@MultiORMEntity('integration_trello_board_mapping', { mikroOrmRepository: () => MikroOrmTrelloBoardMappingRepository })
export class TrelloBoardMapping extends TenantOrganizationBaseEntity {
	/** The connected organization's integration tenant (`integration_tenant`, named `Trello`). */
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((mapping: TrelloBoardMapping) => mapping.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32 })
	trelloBoardId!: string;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	trelloBoardName?: string | null;

	/** The platform project the board's cards become tasks of. */
	@MultiORMManyToOne(() => OrganizationProject, { onDelete: 'CASCADE' })
	@JoinColumn()
	project?: IOrganizationProject;

	@RelationId((mapping: TrelloBoardMapping) => mapping.project)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	projectId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: TrelloSyncDirection.INBOUND })
	direction!: TrelloSyncDirection;

	/** JSON `Record<listId, string>`: the task status name a card gets in each list (archived and done ones aside). */
	@MultiORMColumn({ type: 'text', nullable: true })
	listMap?: string | null;

	@MultiORMColumn({ type: 'boolean', default: true })
	syncEnabled!: boolean;

	/** The webhook registered on the board (Trello signs its deliveries with the application's secret). */
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	webhookId?: string | null;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	lastImportedAt?: Date | null;

	/** The `dateLastActivity` of the newest card imported: the next incremental import takes the cards changed after it. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	lastCursor?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmTrelloBoardMappingRepository extends MikroOrmBaseEntityRepository<TrelloBoardMapping> {}

@Injectable()
export class TypeOrmTrelloBoardMappingRepository extends Repository<TrelloBoardMapping> {
	constructor(@InjectRepository(TrelloBoardMapping) readonly repository: Repository<TrelloBoardMapping>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
