import {
	Entity,
	Column,
	OneToMany,
	JoinColumn,
	ManyToOne,
	RelationId
} from 'typeorm';
import {
	OrganizationSprint as IOrganizationSprint,
	SprintStartDayEnum
} from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Organization } from '../organization/organization.entity';
import {
	IsBoolean,
	IsDate,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString
} from 'class-validator';
import { TenantBase } from '../core/entities/tenant-base';
import { Task } from '../tasks/task.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';

@Entity('organization_sprint')
export class OrganizationSprint extends TenantBase
	implements IOrganizationSprint {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	name: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	goal?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 7 })
	length: number;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endDate?: Date;

	@ApiProperty({ type: Number, enum: SprintStartDayEnum })
	@IsNumber()
	@Column({ nullable: true })
	dayStart?: number;

	@ApiProperty({ type: OrganizationProjects })
	@ManyToOne(
		(type) => OrganizationProjects,
		(project) => project.organizationSprints
	)
	@JoinColumn()
	project?: OrganizationProjects;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isActive?: boolean;

	@ApiProperty({ type: Task })
	@OneToMany((type) => Task, (task) => task.organizationSprint)
	@JoinColumn()
	tasks?: Task[];
}
