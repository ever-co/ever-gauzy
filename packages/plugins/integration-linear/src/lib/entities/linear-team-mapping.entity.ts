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
export enum LinearSyncDirection {
	/** Linear issues become and update tasks; nothing goes back. */
	INBOUND = 'inbound',
	/** Tasks of the project are sent to Linear; nothing comes in. */
	OUTBOUND = 'outbound',
	BOTH = 'both'
}

/**
 * One Linear team mapped to one platform project of a connected organization: the direction, the
 * workflow-state → task-status map (JSON, by Linear state type), and where the last import stopped.
 * A disconnect (the integration tenant goes) or a deleted project takes its mappings with it.
 */
@MultiORMEntity('integration_linear_team_mapping', { mikroOrmRepository: () => MikroOrmLinearTeamMappingRepository })
export class LinearTeamMapping extends TenantOrganizationBaseEntity {
	/** The connected organization's integration tenant (`integration_tenant`, named `Linear`). */
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((mapping: LinearTeamMapping) => mapping.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	linearTeamId!: string;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	linearTeamKey?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	linearTeamName?: string | null;

	/** The platform project the team's issues become tasks of. */
	@MultiORMManyToOne(() => OrganizationProject, { onDelete: 'CASCADE' })
	@JoinColumn()
	project?: IOrganizationProject;

	@RelationId((mapping: LinearTeamMapping) => mapping.project)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	projectId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: LinearSyncDirection.INBOUND })
	direction!: LinearSyncDirection;

	/** JSON `Record<LinearStateType, string>`: the task status name for each kind of Linear state. */
	@MultiORMColumn({ type: 'text', nullable: true })
	stateMap?: string | null;

	@MultiORMColumn({ type: 'boolean', default: true })
	syncEnabled!: boolean;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	lastImportedAt?: Date | null;

	/** The `updatedAt` of the newest issue imported: the next incremental import starts after it. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	lastCursor?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmLinearTeamMappingRepository extends MikroOrmBaseEntityRepository<LinearTeamMapping> {}

@Injectable()
export class TypeOrmLinearTeamMappingRepository extends Repository<LinearTeamMapping> {
	constructor(@InjectRepository(LinearTeamMapping) readonly repository: Repository<LinearTeamMapping>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
