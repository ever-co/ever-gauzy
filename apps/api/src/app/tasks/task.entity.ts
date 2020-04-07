import { Base } from '../core/entities/base';
import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId,
	OneToMany
} from 'typeorm';
import { Task as ITask } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';

@Entity('task')
export class Task extends Base implements ITask {
	@ApiProperty({ type: String })
	@Column()
	title: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	status?: string;

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

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany(
		(type) => InvoiceItem,
		(invoiceItem) => invoiceItem.task
	)
	@JoinColumn()
	invoiceItems?: InvoiceItem[];
}
