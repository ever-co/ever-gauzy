/* eslint-disable @typescript-eslint/no-unused-vars */
import { Column, PrimaryGeneratedColumn } from 'typeorm';
import { MultiORMEntity } from '@gauzy/core';

@MultiORMEntity()
export class ProductReview {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@Column('text')
	body: string;

	@Column()
	rating: number;
}
