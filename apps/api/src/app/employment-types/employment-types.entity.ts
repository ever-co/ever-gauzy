import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('employment_type')
export class EmploymentTypes {
	@PrimaryGeneratedColumn()
	id: string;

	@Column()
	name: string;

	@Column()
	organizationId: string;
}
