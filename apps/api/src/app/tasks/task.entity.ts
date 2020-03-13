import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { Task as ITask } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { OrganizationProjects } from '../organization-projects';

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
	readonly projectId?: string;
}
