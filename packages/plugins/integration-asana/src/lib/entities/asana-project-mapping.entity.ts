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
export enum AsanaSyncDirection {
	/** Asana tasks become and update tasks; nothing goes back. */
	INBOUND = 'inbound',
	/** Tasks of the project are sent to Asana; nothing comes in. */
	OUTBOUND = 'outbound',
	BOTH = 'both'
}

/**
 * One Asana project mapped to one platform project of a connected organization: the direction, the section →
 * task-status map (JSON, by section gid), the webhook Asana delivers the project's events to, and where the last
 * import stopped. A disconnect (the integration tenant goes) or a deleted project takes its mappings with it.
 */
@MultiORMEntity('integration_asana_project_mapping', { mikroOrmRepository: () => MikroOrmAsanaProjectMappingRepository })
export class AsanaProjectMapping extends TenantOrganizationBaseEntity {
	/** The connected organization's integration tenant (`integration_tenant`, named `Asana`). */
	@MultiORMManyToOne(() => IntegrationTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	integration?: IIntegrationTenant;

	@RelationId((mapping: AsanaProjectMapping) => mapping.integration)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	integrationId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	asanaWorkspaceGid!: string;

	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	asanaProjectGid!: string;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	asanaProjectName?: string | null;

	/** The platform project the Asana project's tasks become tasks of. */
	@MultiORMManyToOne(() => OrganizationProject, { onDelete: 'CASCADE' })
	@JoinColumn()
	project?: IOrganizationProject;

	@RelationId((mapping: AsanaProjectMapping) => mapping.project)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	projectId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: AsanaSyncDirection.INBOUND })
	direction!: AsanaSyncDirection;

	/** JSON `Record<sectionGid, string>`: the task status name a task gets in each section (completed ones aside). */
	@MultiORMColumn({ type: 'text', nullable: true })
	sectionMap?: string | null;

	@MultiORMColumn({ type: 'boolean', default: true })
	syncEnabled!: boolean;

	/** The webhook registered on the Asana project, and the secret Asana signs its deliveries with. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	webhookGid?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	webhookSecret?: string | null;

	/** A registration in flight: the single-use token its handshake must carry in the address, and when it started. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	webhookHandshakeToken?: string | null;

	// `Date | null` reflects as `Object` under strictNullChecks (the plugin's lib build), which TypeORM refuses: the type is said.
	@MultiORMColumn({ type: Date, nullable: true })
	webhookHandshakeStartedAt?: Date | null;

	@MultiORMColumn({ type: Date, nullable: true })
	lastImportedAt?: Date | null;

	/** The `modified_at` of the newest task imported: the next incremental import starts from it. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	lastCursor?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string | null;
}

@Injectable()
export class MikroOrmAsanaProjectMappingRepository extends MikroOrmBaseEntityRepository<AsanaProjectMapping> {}

@Injectable()
export class TypeOrmAsanaProjectMappingRepository extends Repository<AsanaProjectMapping> {
	constructor(@InjectRepository(AsanaProjectMapping) readonly repository: Repository<AsanaProjectMapping>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
