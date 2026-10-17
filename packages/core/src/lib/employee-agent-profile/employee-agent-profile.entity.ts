import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	EmployeeAgentSourceEnum,
	EmployeeAgentStatusEnum,
	ID,
	IEmployee,
	IEmployeeAgentProfile
} from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToOne
} from '../core/decorators/entity';
import { MikroOrmEmployeeAgentProfileRepository } from './repository/mikro-orm-employee-agent-profile.repository';

/**
 * The agent-specific facts of an agent employee (`employee.kind = 'agent'`), one row per employee.
 *
 * Part of the Gauzy ↔ Ever Works integration (G-P1-1). The employee row carries what an agent has in
 * common with a person — a name through its user, team and task membership, mentions — and this row
 * carries what only an agent has: the system it is managed by (`source`) and its identifier there
 * (`externalId`), its capabilities, model and runtime status. Integrations write it; people read it.
 *
 * A row is removed with its employee (`ON DELETE CASCADE`), and `reportsToEmployeeId` is cleared when the
 * employee it points at is removed (`ON DELETE SET NULL`).
 */
@MultiORMEntity('employee_agent_profile', { mikroOrmRepository: () => MikroOrmEmployeeAgentProfileRepository })
export class EmployeeAgentProfile extends TenantOrganizationBaseEntity implements IEmployeeAgentProfile {
	[EntityRepositoryType]?: MikroOrmEmployeeAgentProfileRepository;

	/**
	 * The system the agent comes from, e.g. `ever_works`.
	 */
	@ApiProperty({ type: () => String, example: EmployeeAgentSourceEnum.EVER_WORKS })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32 })
	source: EmployeeAgentSourceEnum | string;

	/**
	 * The agent's identifier in its source system.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * The agent's slug in its source system.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	slug?: string;

	/**
	 * The agent's title or role, e.g. "Backend engineer".
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	title?: string;

	/**
	 * What the agent can do, as its source system names it.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@JsonColumn<string[]>({ nullable: true })
	capabilities?: string[];

	/**
	 * The agent's runtime state, as its source system reports it (see `EmployeeAgentStatusEnum`).
	 */
	@ApiPropertyOptional({ type: () => String, example: EmployeeAgentStatusEnum.ACTIVE })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	status?: EmployeeAgentStatusEnum | string;

	/**
	 * The scope the agent works in (e.g. `organization`, `team`, `work`), as its source system names it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	scope?: string;

	/**
	 * The identifier of the scope's target in the source system (a team or work id).
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	scopeTargetId?: string;

	/**
	 * The model the agent runs on, as its source system names it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	modelId?: string;

	/**
	 * The agent's avatar, as its source system serves it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	avatarUrl?: string;

	/**
	 * When the agent last ran.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	lastRunAt?: Date;

	/**
	 * Whether the agent is managed by its source system. A managed agent is read-only in Gauzy: its name
	 * and profile change in the source system and are synced in.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, default: false })
	managedExternally?: boolean;

	/**
	 * The agent's page in its source system.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	externalUrl?: string;

	/**
	 * Source-specific extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, any>>({ nullable: true })
	metadata?: Record<string, any>;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The agent employee this profile belongs to. One profile per employee: the owning side of a
	 * one-to-one relation carries a unique constraint on its join column.
	 */
	@MultiORMOneToOne(() => Employee, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This side owns the relation: the join column lives on this table. */
		owner: true
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeAgentProfile) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The employee this agent reports to, when there is one (a person or another agent).
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	reportsToEmployee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeAgentProfile) => it.reportsToEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	reportsToEmployeeId?: ID;
}
