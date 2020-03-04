import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { User } from '../user';

@Entity()
export class EmployeeTypes {
	@PrimaryGeneratedColumn()
	id: string;

	@Column()
	name: string;

	@Column()
	organizationId: string;
}
