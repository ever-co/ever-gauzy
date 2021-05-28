// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
	Between,
	Brackets,
	DeepPartial,
	DeleteResult,
	FindConditions,
	FindManyOptions,
	FindOneOptions,
	ILike,
	In,
	LessThan,
	Like,
	MoreThan,
	Not,
	Repository,
	SelectQueryBuilder,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { mergeMap } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import { environment as env } from '@gauzy/config';
import * as bcrypt from 'bcrypt';
import { BaseEntity } from '../entities/internal';
import { ICrudService } from './icrud.service';
import { IPagination } from './pagination';
import { ITryRequest } from './try-request';

export abstract class CrudService<T extends BaseEntity>
	implements ICrudService<T> {
	saltRounds: number;

	protected constructor(protected readonly repository: Repository<T>) {
		this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS;
	}

	public async count(filter?: FindManyOptions<T>): Promise<number> {
		return await this.repository.count(filter);
	}

	public async findAll(filter?: FindManyOptions<T>): Promise<IPagination<T>> {
		const total = await this.repository.count(filter);
		const items = await this.repository.find(filter);
		return { items, total };
	}

	public async search(filter?: any): Promise<IPagination<T>> {
		let option: FindManyOptions = {}

		if (filter.page && filter.limit) {
			option.skip = filter.limit * (filter.page - 1);
			option.take = filter.limit;
		}

		if (filter.orderBy && filter.order) {
			option.order = {
				[filter.orderBy]: filter.order
			}
		} else if (filter.orderBy) {
			option.order = filter.orderBy;
		}

		if (filter.relations) {
			option.relations = filter.relations;
		}

		if (filter.join) {
			option.join = filter.join;
		}

		if (filter.filters || filter.where) {
			option.where = (qb: SelectQueryBuilder<T>) => {
				if (filter.filters && Object.values(filter.filters).length > 0) {
					qb.where(new Brackets(qb => {
						const where: any[] = [];
						for (const field in filter.filters) {
							if (Object.prototype.hasOwnProperty.call(filter.filters, field)) {
								const condition = filter.filters[field];
								switch (condition.condition) {
									case 'Like':
										where.push({ [field]: Like(condition.search) });
										break;
									case 'Between':
										where.push({ [field]: Between(condition.search[0], condition.search[1]) });
										break;
									case 'In':
										where.push({ [field]: In(condition.search) });
										break;
									case 'NotIn':
										where.push({ [field]: Not(In(condition.search)) });
										break;
									case 'ILike':
										where.push({ [field]: ILike(condition.search) });
										break;
									case 'MoreThan':
										where.push({ [field]: MoreThan(condition.search) });
										break;
									case 'LessThan':
										where.push({ [field]: LessThan(condition.search) });
										break;
									default:
										where.push({ [field]: condition.search });
										break;
								}
							}
						}
						qb.where(where);
					}));
				}
				if (filter.where) {
					const where: any = {}
					for (const field in filter.where) {
						if (Object.prototype.hasOwnProperty.call(filter.where, field)) {
							if (filter.where[field] instanceof Array) {
								where[field] = In(filter.where[field]);
							} else {
								where[field] = filter.where[field];
							}
						}
					}
					qb.andWhere(new Brackets(qb => {
						qb.where(where);
					}))
				}
				console.log(qb.getQueryAndParameters());
			}
		}

		console.log(option);
		const [items, total] = await this.repository.findAndCount(option);
		return { items, total };
	}

	public async findOneOrFail(
		id: string | number | FindOneOptions<T> | FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<ITryRequest> {
		try {
			const record = await this.repository.findOneOrFail(
				id as any,
				options
			);
			return {
				success: true,
				record
			};
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	}

	public async findOne(
		id: string | number | FindOneOptions<T> | FindConditions<T>,
		options?: FindOneOptions<T>
	): Promise<T> {
		const record = await this.repository.findOne(id as any, options);
		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		return record;
	}

	public async create(entity: DeepPartial<T>, ...options: any[]): Promise<T> {
		const obj = this.repository.create(entity);
		try {
			// https://github.com/Microsoft/TypeScript/issues/21592
			return await this.repository.save(obj as any);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	public async update(
		id: string | number | FindConditions<T>,
		partialEntity: QueryDeepPartialEntity<T>,
		...options: any[]
	): Promise<UpdateResult | T> {
		try {
			// method getPasswordHash is copied from AuthService
			// try if can import somehow the service and use its method

			if (partialEntity['hash']) {
				const hashPassword = await this.getPasswordHash(
					partialEntity['hash']
				);
				partialEntity['hash'] = hashPassword;
			}

			return await this.repository.update(id, partialEntity);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	public async delete(
		criteria: string | number | FindConditions<T>,
		...options: any[]
	): Promise<DeleteResult> {
		try {
			return await this.repository.delete(criteria);
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/**
	 * e.g., findOneById(id).pipe(map(entity => entity.id), entityNotFound())
	 */
	private entityNotFound() {
		return (stream$) =>
			stream$.pipe(
				mergeMap((signal) => {
					if (!signal) {
						return throwError(
							new NotFoundException(
								`The requested record was not found`
							)
						);
					}
					return of(signal);
				})
			);
	}
}
