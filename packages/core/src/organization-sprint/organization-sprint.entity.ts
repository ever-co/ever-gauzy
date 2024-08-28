import { JoinColumn, JoinTable } from 'typeorm';
import { IOrganizationProjectModule, IOrganizationSprint, SprintStartDayEnum } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import {
	OrganizationProject,
	OrganizationProjectModule,
	Task,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import {
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmOrganizationSprintRepository } from './repository/mikro-orm-organization-sprint.repository';

@MultiORMEntity('organization_sprint', { mikroOrmRepository: () => MikroOrmOrganizationSprintRepository })
export class OrganizationSprint extends TenantOrganizationBaseEntity implements IOrganizationSprint {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	goal?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 7 })
	length: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiProperty({ type: () => Number, enum: SprintStartDayEnum })
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	dayStart?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationProject Relationship
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.organizationSprints, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project?: OrganizationProject;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ relationId: true })
	projectId: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => Task })
	@MultiORMOneToMany(() => Task, (task) => task.organizationSprint)
	@JoinColumn()
	tasks?: Task[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Project Module
	 */
	@MultiORMManyToMany(() => OrganizationProjectModule, (it) => it.organizationSprints, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinTable()
	modules?: IOrganizationProjectModule[];
}
