import { Base } from '../core/entities/base';
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

import { Task as ITask, TaskStatusEnum } from '@gauzy/models';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { User } from '../user/user.entity';

@Entity('task')
export class Task extends Base implements ITask {
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

	@ApiProperty({ type: OrganizationProjects })
	@ManyToOne((type) => OrganizationProjects, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project?: OrganizationProjects;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((task: Task) => task.project)
	@Column()
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
}
