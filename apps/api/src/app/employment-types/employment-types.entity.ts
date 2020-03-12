import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { Employee } from '../employee';

@Entity()
export class EmploymentTypes {
	@PrimaryGeneratedColumn()
	id: string;

	@Column()
	name: string;

	@Column()
	organizationId: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'employee_employment_types'
	})
	employees?: Employee[];
}
