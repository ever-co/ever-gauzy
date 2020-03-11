import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class EmployeeLevel {
	@PrimaryGeneratedColumn()
	id: string;

	@Column()
	level: string;

	@Column()
	organizationId: string;
}
