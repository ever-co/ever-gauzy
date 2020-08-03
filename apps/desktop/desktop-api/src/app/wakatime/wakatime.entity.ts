import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'heartbeats' })
@Unique(['time', 'entities']) // named; multiple fields
export class Wakatime {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ nullable: true })
	user_agent: string;

	@Column({ nullable: true })
	type: string;

	@Column({ nullable: true })
	employeeId: string;

	@Column({ type: 'real' })
	time: number;

	@Column({ nullable: true })
	categories: string;

	@Column({ nullable: true })
	dependencies: string;

	@Column({ nullable: true })
	languages: string;

	@Column({ nullable: true })
	machine: string;

	@Column({ nullable: true })
	projects: string;

	@Column({ nullable: true })
	branches: string;

	@Column({ nullable: true })
	operating_systems: string;

	@Column()
	entities: string;

	@Column({ nullable: true })
	editors: string;

	@Column({ nullable: true })
	lines: string;

	@Column({ nullable: true })
	is_write: boolean;
}
