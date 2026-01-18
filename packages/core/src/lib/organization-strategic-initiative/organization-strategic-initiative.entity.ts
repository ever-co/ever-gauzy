import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	ID,
	IEmployee,
	IGoal,
	IOrganizationProject,
	IOrganizationStrategicInitiative,
	IOrganizationStrategicSignals,
	OrganizationStrategicStateEnum,
	OrganizationStrategicVisibilityScopeEnum
} from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { Employee, Goal, OrganizationProject, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from '../core/decorators/entity';
import { MikroOrmOrganizationStrategicInitiativeRepository } from './repository/mikro-orm-organization-strategic-initiative.repository';

@MultiORMEntity('organization_strategic_initiative', { mikroOrmRepository: () => MikroOrmOrganizationStrategicInitiativeRepository })
export class OrganizationStrategicInitiative extends TenantOrganizationBaseEntity implements IOrganizationStrategicInitiative {
	[EntityRepositoryType]?: MikroOrmOrganizationStrategicInitiativeRepository;

	/**
	 * Title - Short, human-readable name for the initiative
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	title: string;

	/**
	 * Intent - Long-form description of the strategic intent
	 * Answers: "What are we deliberately trying to move forward — and why?"
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	intent?: string;

	/**
	 * Strategic State - Current lifecycle phase
	 * - draft: Strategic intent is being articulated
	 * - active: Leadership validated, projects are being aligned
	 * - resolved: Strategy fulfilled its purpose
	 * - retired: Strategy discontinued or transformed
	 */
	@ApiProperty({ type: () => String, enum: OrganizationStrategicStateEnum })
	@IsNotEmpty()
	@IsEnum(OrganizationStrategicStateEnum)
	@ColumnIndex()
	@MultiORMColumn({ default: OrganizationStrategicStateEnum.DRAFT })
	state: OrganizationStrategicStateEnum;

	/**
	 * Visibility Scope - Who can see this initiative
	 * - leadership: Only organization admins/managers
	 * - organization: All organization members
	 * - team: Members of teams linked to associated projects
	 */
	@ApiProperty({ type: () => String, enum: OrganizationStrategicVisibilityScopeEnum })
	@IsNotEmpty()
	@IsEnum(OrganizationStrategicVisibilityScopeEnum)
	@ColumnIndex()
	@MultiORMColumn({ default: OrganizationStrategicVisibilityScopeEnum.ORGANIZATION })
	visibilityScope: OrganizationStrategicVisibilityScopeEnum;

	/**
	 * Strategic Signals - Qualitative signals stored as structured metadata
	 * These are human-authored and NOT derived automatically from project data
	 * Includes: confidenceLevel, perceivedMomentum, knownRisks, strategicNotes
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
		nullable: true
	})
	signals?: IOrganizationStrategicSignals | string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Steward - Owns the clarity of the strategy's intent
	 * Responsible for directional integrity, not delivery
	 * They do NOT manage daily execution
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not */
		nullable: true,
		/** Database cascade action on delete */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	steward?: IEmployee;

	/**
	 * Steward ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationStrategicInitiative) => it.steward)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	stewardId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Goals aligned with this initiative (ManyToOne from Goal side)
	 * A Goal can be optionally aligned to ONE strategic initiative
	 * Provides strategic context to OKR measurements
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@MultiORMOneToMany(() => Goal, (goal) => goal.organizationStrategicInitiative)
	goals?: IGoal[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Projects aligned with this initiative (ManyToMany)
	 * A Project can contribute to multiple strategic directions simultaneously
	 * Note: This is the inverse side of the relationship
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@MultiORMManyToMany(() => OrganizationProject, (project) => project.organizationStrategicInitiatives, {
		/** Defines the database action to perform on update */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete */
		onDelete: 'CASCADE'
	})
	projects?: IOrganizationProject[];
}
