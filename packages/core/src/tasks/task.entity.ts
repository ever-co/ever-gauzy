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
import { ITask, IUser, TaskStatusEnum } from '@gauzy/contracts';
import {
	Employee,
	InvoiceItem,
	OrganizationProject,
	OrganizationSprint,
	OrganizationTeam,
	Tag,
	TenantOrganizationBaseEntity,
	TimeLog,
	User
} from '../core/entities/internal';

@Entity('task')
export class Task extends TenantOrganizationBaseEntity implements ITask {
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (tag) => tag.task)
	@JoinTable({
		name: 'tag_task'
	})
	tags?: Tag[];

	@ApiProperty({ type: () => String })
	@Column()
	title: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String, enum: TaskStatusEnum })
	@Column()
	status?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	@IsOptional()
	estimate?: number;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	@IsOptional()
	dueDate?: Date;

	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne((type) => OrganizationProject, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project?: OrganizationProject;

	@OneToMany(() => TimeLog, (timeLog) => timeLog.task)
	timeLogs?: TimeLog[];

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((task: Task) => task.project)
	@Column({ nullable: true })
	readonly projectId?: string;

	@ManyToMany(() => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'task_employee'
	})
	readonly members?: Employee[];

	@ManyToMany(() => OrganizationTeam, { cascade: ['update'] })
	@JoinTable({
		name: 'task_team'
	})
	teams?: OrganizationTeam[];

	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany((type) => InvoiceItem, (invoiceItem) => invoiceItem.task)
	@JoinColumn()
	invoiceItems?: InvoiceItem[];

	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((task: Task) => task.creator)
	@Column()
	readonly creatorId?: string;

	@ApiProperty({ type: () => OrganizationSprint })
	@ManyToOne(() => OrganizationSprint, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationSprint?: OrganizationSprint;
}
