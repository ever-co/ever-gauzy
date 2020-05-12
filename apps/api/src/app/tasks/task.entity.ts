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
import { Task as ITask } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { IsOptional } from 'class-validator';

@Entity('task')
export class Task extends Base implements ITask {
	@ApiProperty({ type: Tag })
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_task'
	})
	tags: Tag[];

	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
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
	project: OrganizationProjects;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((task: Task) => task.project)
	@Column()
	readonly projectId?: string;

	@ApiProperty({ type: String, readOnly: true })
	@Column()
	readonly members?: string;

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany(
		(type) => InvoiceItem,
		(invoiceItem) => invoiceItem.task
	)
	@JoinColumn()
	invoiceItems?: InvoiceItem[];
}
