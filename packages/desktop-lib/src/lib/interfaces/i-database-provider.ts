import { Knex } from 'knex';

export interface IDatabaseProvider {
	get connection(): Knex;
	get config(): Knex.Config;
}
