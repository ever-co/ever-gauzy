import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'entities' })
export class Entities {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;
}
