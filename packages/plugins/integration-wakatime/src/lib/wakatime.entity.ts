import { Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { IWakatime } from '@gauzy/contracts';
import { MultiORMColumn } from '@gauzy/core';

@Entity({ name: 'heartbeats' })
@Unique(['time', 'entities']) // named; multiple fields
export class Wakatime implements IWakatime {
	@PrimaryGeneratedColumn()
	id: number;

	@MultiORMColumn({ nullable: true })
	user_agent: string;

	@MultiORMColumn({ nullable: true })
	type: string;

	@MultiORMColumn({ nullable: true })
	employeeId: string;

	@MultiORMColumn({ type: 'real' })
	time: number;

	@MultiORMColumn({ nullable: true })
	categories: string;

	@MultiORMColumn({ nullable: true })
	dependencies: string;

	@MultiORMColumn({ nullable: true })
	languages: string;

	@MultiORMColumn({ nullable: true })
	machine: string;

	@MultiORMColumn({ nullable: true })
	projects: string;

	@MultiORMColumn({ nullable: true })
	branches: string;

	@MultiORMColumn({ nullable: true })
	operating_systems: string;

	@MultiORMColumn()
	entities: string;

	@MultiORMColumn({ nullable: true })
	editors: string;

	@MultiORMColumn({ nullable: true })
	lines: string;

	@MultiORMColumn({ nullable: true })
	is_write: boolean;
}
