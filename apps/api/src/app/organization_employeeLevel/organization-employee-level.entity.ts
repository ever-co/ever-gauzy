import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tag } from '../tags/tag.entity';
import { Base } from '../core/entities/base';

@Entity({
	name: 'organization_employee_level'
})
export class EmployeeLevel extends Base {
	@ApiProperty()
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_organization_employee_level'
	})
	tags: Tag[];

	@Column()
	level: string;

	@Column()
	organizationId: string;
}
