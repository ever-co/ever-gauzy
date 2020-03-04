import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class EmployeeTypes {
	@PrimaryGeneratedColumn()
	id: string;

	@Column()
	name: string;

	@Column()
	organizationId: string;
}
