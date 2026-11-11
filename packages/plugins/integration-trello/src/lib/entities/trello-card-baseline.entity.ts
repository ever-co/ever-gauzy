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
 * What a card and its task last agreed on: the synced fields as Trello sent them the last time the card was
 * applied. The next apply compares the task and the card with it, so a field changed on one side follows that
 * side, and one changed on both is a conflict. One row per card of a connection.
 */
@MultiORMEntity('integration_trello_card_baseline', { mikroOrmRepository: () => MikroOrmTrelloCardBaselineRepository })
export class TrelloCardBaseline extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((baseline: TrelloCardBaseline) => baseline.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	/** The Trello card's id. */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	sourceId!: string;

	/** The task the card is (a plain id). */
	@MultiORMColumn({ type: 'varchar', length: 36 })
	taskId!: ID;

	/** The agreed values (JSON: `title`, `description`, `status`, `priority`, `dueDate`). */
	@MultiORMColumn({ type: 'text' })
	syncedFields!: string;
}

@Injectable()
export class MikroOrmTrelloCardBaselineRepository extends MikroOrmBaseEntityRepository<TrelloCardBaseline> {}

@Injectable()
export class TypeOrmTrelloCardBaselineRepository extends Repository<TrelloCardBaseline> {
	constructor(@InjectRepository(TrelloCardBaseline) readonly repository: Repository<TrelloCardBaseline>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
