import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'machine' })
export class Machine {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	machine_id: string;
}
