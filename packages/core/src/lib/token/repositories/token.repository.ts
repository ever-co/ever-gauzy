import { IUser } from '@gauzy/contracts';
import { LockMode } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { Between, In, LessThan, MoreThan } from 'typeorm';
import { MultiORMEnum } from '../../core';
import { CrudService } from '../../core/crud/crud.service';
import { Token } from '../entities/token.entity';
import { IToken, ITokenFilters, ITokenQueryResult, ITokenRepository, TokenStatus } from '../interfaces';
import { MikroOrmTokenRepository } from './micro-orm';
import { TypeOrmTokenRepository } from './type-orm';

@Injectable()
export class TokenRepository extends CrudService<Token> implements ITokenRepository {
	constructor(
		readonly typeOrmTokenRepository: TypeOrmTokenRepository,
		readonly mikroOrmTokenRepository: MikroOrmTokenRepository
	) {
		super(typeOrmTokenRepository, mikroOrmTokenRepository);
	}

	async findByHashWithLock(tokenHash: string): Promise<IToken | null> {
		if (this.ormType === MultiORMEnum.TypeORM) {
			return this.typeOrmTokenRepository
				.createQueryBuilder('token')
				.where('token.tokenHash = :tokenHash', { tokenHash })
				.setLock('pessimistic_write')
				.getOne();
		}
		// MikroORM: use em.lock() for pessimistic locking
		const token = await this.mikroOrmTokenRepository.findOne({ tokenHash });
		if (token) {
			const em = this.mikroOrmTokenRepository.getEntityManager();
			await em.lock(token, LockMode.PESSIMISTIC_WRITE);
		}
		return token;
	}

	async findByHash(tokenHash: string): Promise<IToken | null> {
		return this.findOneByWhereOptions({
			tokenHash
		});
	}

	async findById(id: string): Promise<IToken | null> {
		return this.findOneByWhereOptions({
			id
		});
	}

	async findActiveByUserAndType(userId: string, tokenType: string): Promise<IToken[]> {
		return this.find({
			where: {
				userId,
				tokenType: tokenType,
				status: TokenStatus.ACTIVE
			},
			order: {
				createdAt: 'DESC'
			}
		});
	}

	override async create(tokenData: Partial<IToken>): Promise<IToken> {
		const token = await super.create(tokenData);
		return this.save(token);
	}

	override async save(token: IToken): Promise<IToken> {
		return super.save(token);
	}

	async updateStatus(
		tokenId: string,
		status: TokenStatus,
		version: number,
		additionalData?: Partial<IToken>
	): Promise<boolean> {
		const updateData: any = {
			status,
			...additionalData
		};

		if (status === TokenStatus.REVOKED) {
			updateData.revokedAt = new Date();
		}

		const result = await this.update(
			{
				id: tokenId,
				version // Optimistic locking
			},
			updateData
		);

		return result?.['id'] || result?.['affected'] === 1;
	}

	async updateLastUsed(tokenId: string): Promise<void> {
		await this.update(
			{ id: tokenId },
			{
				lastUsedAt: new Date(),
				usageCount: () => 'usageCount + 1'
			}
		);
	}

	async revokeAllByUserAndType(
		userId: string,
		tokenType: string,
		revokedById?: IUser['id'],
		reason?: string
	): Promise<number> {
		const result = await this.update(
			{
				userId,
				tokenType: tokenType,
				status: TokenStatus.ACTIVE
			},
			{
				status: TokenStatus.REVOKED,
				revokedAt: new Date(),
				revokedById,
				revokedReason: reason
			}
		);

		return result?.['id'] || result?.['affected'] || 0;
	}

	async revokeInactiveTokens(tokenType: string, inactivityThresholdMs: number): Promise<number> {
		const thresholdDate = new Date(Date.now() - inactivityThresholdMs);

		const result = await this.update(
			{
				tokenType: tokenType,
				status: TokenStatus.ACTIVE,
				lastUsedAt: LessThan(thresholdDate)
			},
			{
				status: TokenStatus.REVOKED,
				revokedAt: new Date(),
				revokedReason: 'Inactivity timeout'
			}
		);

		return result?.['id'] || result?.['affected'] || 0;
	}

	async markExpiredTokens(): Promise<number> {
		const now = new Date();

		const result = await this.update(
			{
				status: TokenStatus.ACTIVE,
				expiresAt: LessThan(now)
			},
			{
				status: TokenStatus.EXPIRED
			}
		);

		return result?.['id'] || result?.['affected'] || 0;
	}

	async query(filters: ITokenFilters, limit: number = 100, offset: number = 0): Promise<ITokenQueryResult> {
		const where: any = {};

		if (filters.userId) where.userId = filters.userId;
		if (filters.tokenType) where.tokenType = filters.tokenType;
		if (filters.status) where.status = filters.status;
		if (filters.createdAfter && filters.createdBefore) {
			where.createdAt = Between(filters.createdAfter, filters.createdBefore);
		} else if (filters.createdAfter) {
			where.createdAt = MoreThan(filters.createdAfter);
		} else if (filters.createdBefore) {
			where.createdAt = LessThan(filters.createdBefore);
		}

		return this.paginate({
			where,
			take: limit,
			skip: offset,
			order: {
				createdAt: 'DESC'
			}
		});
	}

	async deleteOlderThan(date: Date, status?: TokenStatus[]): Promise<number> {
		const where: any = {
			createdAt: LessThan(date)
		};

		if (status && status.length > 0) {
			where.status = In(status);
		}

		const result = await this.delete(where);
		return result?.['id'] || result?.['affected'] || 0;
	}

	async transaction<T>(work: (repository: ITokenRepository) => Promise<T>): Promise<T> {
		// Run work inside a DB transaction depending on active ORM
		if (this.ormType === MultiORMEnum.TypeORM) {
			return this.typeOrmTokenRepository.manager.transaction(async (entityManager) => {
				const transactionalRepo = entityManager.getRepository(Token);

				const repo: ITokenRepository = {
					findByHashWithLock: async (tokenHash: string) => {
						return transactionalRepo
							.createQueryBuilder('token')
							.where('token.tokenHash = :tokenHash', { tokenHash })
							.setLock('pessimistic_write')
							.getOne();
					},
					findByHash: async (tokenHash: string) => transactionalRepo.findOne({ where: { tokenHash } }),
					findById: async (id: string) => transactionalRepo.findOne({ where: { id } }),
					findActiveByUserAndType: async (userId: string, tokenType: string) =>
						transactionalRepo.find({
							where: { userId, tokenType, status: TokenStatus.ACTIVE },
							order: { createdAt: 'DESC' }
						}),
					create: async (tokenData: Partial<IToken>) => {
						const token = transactionalRepo.create(tokenData);
						return transactionalRepo.save(token);
					},
					save: async (token: IToken) => transactionalRepo.save(token),
					updateStatus: async (
						tokenId: string,
						status: TokenStatus,
						version: number,
						additionalData?: Partial<IToken>
					) => {
						const updateData = { status, ...additionalData };
						if (status === TokenStatus.REVOKED) updateData.revokedAt = new Date();
						const result = await transactionalRepo.update({ id: tokenId, version }, updateData);
						return result?.['id'] || result?.['affected'] === 1;
					},
					updateLastUsed: async (tokenId: string) => {
						await transactionalRepo.update(
							{ id: tokenId },
							{
								lastUsedAt: new Date(),
								usageCount: () => 'usageCount + 1'
							}
						);
					},
					revokeAllByUserAndType: async (
						userId: string,
						tokenType: string,
						revokedById?: IUser['id'],
						reason?: string
					) => {
						const result = await transactionalRepo.update(
							{ userId, tokenType: tokenType, status: TokenStatus.ACTIVE },
							{
								status: TokenStatus.REVOKED,
								revokedAt: new Date(),
								revokedById,
								revokedReason: reason
							}
						);
						return result?.['id'] || result?.['affected'] || 0;
					},
					revokeInactiveTokens: async (tokenType: string, threshold: number) => {
						const thresholdDate = new Date(Date.now() - threshold);
						const result = await transactionalRepo.update(
							{
								tokenType: tokenType,
								status: TokenStatus.ACTIVE,
								lastUsedAt: LessThan(thresholdDate)
							},
							{
								status: TokenStatus.REVOKED,
								revokedAt: new Date(),
								revokedReason: 'Inactivity timeout'
							}
						);
						return result?.['id'] || result?.['affected'] || 0;
					},
					markExpiredTokens: async () => {
						const now = new Date();
						const result = await transactionalRepo.update(
							{ status: TokenStatus.ACTIVE, expiresAt: LessThan(now) },
							{ status: TokenStatus.EXPIRED }
						);
						return result?.['id'] || result?.['affected'] || 0;
					},
					query: async (filters: ITokenFilters, limit: number = 100, offset: number = 0) => {
						const where: any = {};
						if (filters.userId) where.userId = filters.userId;
						if (filters.tokenType) where.tokenType = filters.tokenType;
						if (filters.status) where.status = filters.status;
						if (filters.createdAfter && filters.createdBefore) {
							where.createdAt = Between(filters.createdAfter, filters.createdBefore);
						} else if (filters.createdAfter) {
							where.createdAt = MoreThan(filters.createdAfter);
						} else if (filters.createdBefore) {
							where.createdAt = LessThan(filters.createdBefore);
						}
						const [items, total] = await transactionalRepo.findAndCount({
							where,
							take: limit,
							skip: offset,
							order: { createdAt: 'DESC' }
						});
						return { items, total };
					},
					deleteOlderThan: async (date: Date, status?: TokenStatus[]) => {
						const where: any = { createdAt: LessThan(date) };
						if (status && status.length > 0) where.status = In(status);
						const result = await transactionalRepo.delete(where);
						return result?.['id'] || result?.['affected'] || 0;
					},
					transaction: async <U>(w: (r: ITokenRepository) => Promise<U>) => {
						return w(repo);
					}
				} as ITokenRepository;

				return work(repo);
			});
		} else {
			// MikroORM transaction
			return this.mikroOrmTokenRepository.getEntityManager().transactional(async (em) => {
				const transactionalRepo = em.getRepository(Token);

				const repo: ITokenRepository = {
					findByHashWithLock: async (tokenHash: string) => {
						// MikroORM: fallback to simple findOne within transaction
						return transactionalRepo.findOne({ tokenHash });
					},
					findByHash: async (tokenHash: string) => transactionalRepo.findOne({ tokenHash }),
					findById: async (id: string) => transactionalRepo.findOne(id),
					findActiveByUserAndType: async (userId: string, tokenType: string) =>
						transactionalRepo.find({ userId, tokenType, status: TokenStatus.ACTIVE }),
					create: async (tokenData: Partial<IToken>) => {
						const token = transactionalRepo.create(tokenData);
						await transactionalRepo.insert(token);
						return token;
					},
					save: async (token: IToken) => transactionalRepo.upsert(token),
					updateStatus: async (
						tokenId: string,
						status: TokenStatus,
						version: number,
						additionalData?: Partial<IToken>
					) => {
						const updateData: any = { status, ...additionalData };
						if (status === TokenStatus.REVOKED) updateData.revokedAt = new Date();
						const res = await transactionalRepo.nativeUpdate({ id: tokenId, version }, updateData);
						return !!res;
					},
					updateLastUsed: async (tokenId: string) => {
						await transactionalRepo.nativeUpdate({ id: tokenId }, {
							lastUsedAt: new Date(),
							usageCount: () => 'usageCount + 1'
						} as any);
					},
					revokeAllByUserAndType: async (
						userId: string,
						tokenType: string,
						revokedById?: IUser['id'],
						reason?: string
					) => {
						const result = await transactionalRepo.nativeUpdate(
							{ userId, tokenType, status: TokenStatus.ACTIVE },
							{
								status: TokenStatus.REVOKED,
								revokedAt: new Date(),
								revokedById,
								revokedReason: reason
							}
						);
						return result || 0;
					},
					revokeInactiveTokens: async (tokenType: string, inactivityThresholdMs: number) => {
						const thresholdDate = new Date(Date.now() - inactivityThresholdMs);
						const result = await transactionalRepo.nativeUpdate(
							{
								tokenType,
								status: TokenStatus.ACTIVE,
								lastUsedAt: { $lt: thresholdDate }
							},
							{
								status: TokenStatus.REVOKED,
								revokedAt: new Date(),
								revokedReason: 'Inactivity timeout'
							}
						);
						return result || 0;
					},
					markExpiredTokens: async () => {
						const now = new Date();
						const result = await transactionalRepo.nativeUpdate(
							{ status: TokenStatus.ACTIVE, expiresAt: { $lt: now } },
							{ status: TokenStatus.EXPIRED }
						);
						return result || 0;
					},
					query: async (filters: ITokenFilters, limit: number = 100, offset: number = 0) => {
						const where: any = {};
						if (filters.userId) where.userId = filters.userId;
						if (filters.tokenType) where.tokenType = filters.tokenType;
						if (filters.status) where.status = filters.status;
						if (filters.createdAfter || filters.createdBefore) {
							where.createdAt = {
								...(filters.createdAfter ? { $gt: filters.createdAfter } : {}),
								...(filters.createdBefore ? { $lt: filters.createdBefore } : {})
							};
						}
						const [items, total] = await transactionalRepo.findAndCount(where, {
							limit,
							offset,
							orderBy: { createdAt: 'DESC' }
						});
						return { items, total };
					},
					deleteOlderThan: async (date: Date, status?: TokenStatus[]) => {
						const where: any = { createdAt: { $lt: date } };
						if (status && status.length > 0) where.status = { $in: status };
						const result = await transactionalRepo.nativeDelete(where);
						return result || 0;
					},
					transaction: async <U>(w: (r: ITokenRepository) => Promise<U>) => {
						return w(repo);
					}
				} as ITokenRepository;

				return work(repo);
			});
		}
	}
}
