/* eslint-disable @typescript-eslint/no-unused-vars */
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ProductReview {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@Column('text')
	body: string;

	@Column()
	rating: number;
}
