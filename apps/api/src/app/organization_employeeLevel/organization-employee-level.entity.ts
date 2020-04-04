import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({
	name: 'organization_employee_level'
})
export class EmployeeLevel {
	@PrimaryGeneratedColumn()
	id: string;

	@Column()
	level: string;

	@Column()
	organizationId: string;
}
