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
	FindOperator,
	ILike,
	In,
	LessThan,
	Like,
	MoreThan,
	Not,
	Repository,
	SelectQueryBuilder,
	UpdateResult,
	WhereExpression
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
		let options: FindManyOptions = {}
		if (filter.page && filter.limit) {
			options.skip = filter.limit * (filter.page - 1);
			options.take = filter.limit;
		}

		if (filter.orderBy && filter.order) {
			options.order = {
				[filter.orderBy]: filter.order
			}
		} else if (filter.orderBy) {
			options.order = filter.orderBy;
		}

		if (filter.relations) {
			options.relations = filter.relations;
		}

		if (filter.join) {
			options.join = filter.join;
		}

		if (filter.filters || filter.where) {
			options.where = (qb: SelectQueryBuilder<T>) => {
				if (filter.filters && Object.values(filter.filters).length > 0) {
					qb.andWhere(new Brackets((bck: WhereExpression) => {
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
						bck.where(where);
					}));
				}
				if (filter.where) {
					const wheres: any = {}
					for (const field in filter.where) {
						if (Object.prototype.hasOwnProperty.call(filter.where, field)) {
							wheres[field] = filter.where[field];
						}
					}
					qb.andWhere(new Brackets((bck: WhereExpression) => { 
						for (let [column, value] of Object.entries(wheres)) {
							// query using find operator
							if (value instanceof FindOperator) {
								bck.andWhere(
									new Brackets(
										(bck: WhereExpression) => { 
											bck.where({ [column]: value }); 
										}
									)
								);
							} else if (value instanceof Object) {
								const entries =  value;
								const alias = column;

								// relational tables query
								for (let [column, entry] of Object.entries(entries)) {
									if (entry instanceof FindOperator) {
										const operator = entry;
										const { type, value } = operator;
										switch (type) {
											default:
												bck.andWhere(`"${alias}"."${column}" ${type} (:...${column})`, { 
													[column]: value
												});
												break;
										}
									}
								}
							} else if (value instanceof Array) {
								bck.andWhere(`"${qb.alias}"."${column}" IN (:...${column})`, { 
									[column]: value 
								});
							} else {
								bck.andWhere(`"${qb.alias}"."${column}" = :${column}`, { 
									[column]: value 
								});
							}
						}
					}));
				}
				console.log(options, 'options');
				console.log(qb.getQueryAndParameters());
			}
		}
		const [items, total] = await this.repository.findAndCount(options);
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
