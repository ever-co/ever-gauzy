// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

export interface IPaginationInput {
	limit?: number;
	page?: number;
}

/**
 * Select find options for specific entity.
 * Property paths (column names) to be selected by "find".
 */
export type IOptionsSelect<T> = {
	[P in keyof T]?: NonNullable<T[P]> | boolean;
}

/**
* Generic pagination interface
*/
export interface IPagination<T> {
	/**
	 * Items included in the current listing
	 */
	readonly items: T[];

	/**
	 * Total number of available items
	 */
	readonly total: number;
}

/*
* Common query parameter
*/
export interface IListQueryInput<T> {
	/**
	 * Model entity defined relations
	 */
	readonly relations?: string[];
	readonly findInput?: T | any;
	readonly where?: any;
}

/**
 * Describes generic pagination params
 */
export interface IPaginationParam extends IOptionParams {
	/**
	 * Limit (paginated) - max number of entities should be taken.
	 */
	readonly take: number;
	/**
	 * Offset (paginated) where from entities should be taken.
	 */
	readonly skip: number;
}

export interface IOptionParams {
	/**
	 * Order, in which entities should be ordered.
	 */
	readonly order: any;
	/**
	 * Simple condition that should be applied to match entities.
	 */
	readonly where: any;
	/**
	* Indicates if soft-deleted rows should be included in entity result.
	*/
	readonly withDeleted: boolean;
}
