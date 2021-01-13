import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId,
	OneToMany,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ITask, TaskStatusEnum } from '@gauzy/common';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { User } from '../user/user.entity';
import { OrganizationSprint } from '../organization-sprint/organization-sprint.entity';
import { TimeLog } from '../timesheet/time-log.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('task')
export class Task extends TenantOrganizationBase implements ITask {
	@ApiProperty({ type: Tag })
	@ManyToMany((type) => Tag, (tag) => tag.task)
	@JoinTable({
		name: 'tag_task'
	})
	tags?: Tag[];

	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String, enum: TaskStatusEnum })
	@Column()
	status?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true })
	@IsOptional()
	estimate?: number;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	@IsOptional()
	dueDate?: Date;

	@ApiProperty({ type: OrganizationProject })
	@ManyToOne((type) => OrganizationProject, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project?: OrganizationProject;

	@OneToMany((type) => TimeLog, (timeLog) => timeLog.task)
	timeLogs?: TimeLog[];

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((task: Task) => task.project)
	@Column({ nullable: true })
	readonly projectId?: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'task_employee'
	})
	readonly members?: Employee[];

	@ManyToMany((type) => OrganizationTeam, { cascade: ['update'] })
	@JoinTable({
		name: 'task_team'
	})
	teams?: OrganizationTeam[];

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany((type) => InvoiceItem, (invoiceItem) => invoiceItem.task)
	@JoinColumn()
	invoiceItems?: InvoiceItem[];

	@ApiProperty({ type: User })
	@ManyToOne((type) => User, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: User;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((task: Task) => task.creator)
	@Column()
	readonly creatorId?: string;

	@ApiProperty({ type: OrganizationSprint })
	@ManyToOne((type) => OrganizationSprint, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationSprint?: OrganizationSprint;
}
