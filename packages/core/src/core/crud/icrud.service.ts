// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	DeepPartial,
	DeleteResult,
	FindConditions,
	FindManyOptions,
	FindOneOptions,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPagination } from '@gauzy/contracts';

export interface ICrudService<T> {
	count(filter?: FindManyOptions<T>): Promise<number>;
	findAll(filter?: FindManyOptions<T>): Promise<IPagination<T>>;
	paginate(filter?: FindManyOptions<T>): Promise<IPagination<T>>;
	findOneByIdString(id: string, options?: FindOneOptions<T>): Promise<T>;
	findOneByIdNumber(id: number, options?: FindOneOptions<T>): Promise<T>;
	findOneByConditions(id: FindConditions<T>, options?: FindOneOptions<T>): Promise<T>;
	findOneByOptions(options: FindOneOptions<T>): Promise<T>;
	create(entity: DeepPartial<T>, ...options: any[]): Promise<T>;
	update(
		id: any,
		entity: QueryDeepPartialEntity<T>,
		...options: any[]
	): Promise<UpdateResult | T>;
	delete(id: any, ...options: any[]): Promise<DeleteResult>;
}
