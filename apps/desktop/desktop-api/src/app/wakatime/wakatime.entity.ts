import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'user_agent' })
export class Wakatime {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	user_agent: string;

	@Column()
	type: string;

	@Column()
	employeeId: string;

	@Column({ type: 'real' })
	time: number;
}
