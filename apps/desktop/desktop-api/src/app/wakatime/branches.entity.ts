import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'branches' })
export class Branches {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;
}
