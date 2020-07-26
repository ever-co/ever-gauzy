import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'languages' })
export class Languages {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;
}
