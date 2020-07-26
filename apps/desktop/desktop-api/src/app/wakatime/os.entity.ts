import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'os' })
export class Os {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;
}
