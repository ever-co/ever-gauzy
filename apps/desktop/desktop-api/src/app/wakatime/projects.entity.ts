import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'projects' })
export class Projects {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;
}
