import { IUser } from '@gauzy/contracts';
import { LockMode, raw } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { Between, EntityManager, In, LessThan, MoreThan } from 'typeorm';
import { MultiORMEnum } from '../../core';
import { CrudService } from '../../core/crud/crud.service';
import { Token } from '../entities/token.entity';
import { IToken, ITokenFilters, ITokenQueryResult, ITokenRepository, TokenStatus } from '../interfaces';
import { MikroOrmTokenRepository } from './micro-orm';
import { buildMikroOrmAdapter, buildTypeOrmAdapter } from './orm-adapter.repository';
import { TypeOrmTokenRepository } from './type-orm';

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class TokenRepository extends CrudService<Token> implements ITokenRepository {
	constructor(
		readonly typeOrmTokenRepository: TypeOrmTokenRepository,
		readonly mikroOrmTokenRepository: MikroOrmTokenRepository
	) {
		super(typeOrmTokenRepository, mikroOrmTokenRepository);
	}

	// -- Read -----------------------------------------------------------------

	async findByHashWithLock(tokenHash: string): Promise<IToken | null> {
		if (this.ormType === MultiORMEnum.TypeORM) {
			return this.typeOrmTokenRepository
				.createQueryBuilder('token')
				.where('token.tokenHash = :tokenHash', { tokenHash })
				.setLock('pessimistic_write')
				.getOne();
		}

		const token = await this.mikroOrmTokenRepository.findOne({ tokenHash });
		if (token) {
			const em = this.mikroOrmTokenRepository.getEntityManager();
			await em.lock(token, LockMode.PESSIMISTIC_WRITE);
			await em.refresh(token);
		}
		return token;
	}

	async findByHash(tokenHash: string): Promise<IToken | null> {
		return this.findOneByWhereOptions({ tokenHash });
	}

	async findById(id: string): Promise<IToken | null> {
		return this.findOneByWhereOptions({ id });
	}

	async findActiveByUserAndType(userId: string, tokenType: string): Promise<IToken[]> {
		return this.find({
			where: { userId, tokenType, status: TokenStatus.ACTIVE },
			order: { createdAt: 'DESC' }
		});
	}

	// -- Write ----------------------------------------------------------------

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
		const updateData: any = { status, ...additionalData };
		if (status === TokenStatus.REVOKED) updateData.revokedAt = new Date();

		const result = await this.update({ id: tokenId, version }, updateData);
		return result?.['id'] || result?.['affected'] === 1;
	}

	async updateLastUsed(tokenId: string): Promise<void> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			const em = this.mikroOrmTokenRepository.getEntityManager();
			const tokenMeta = em.getMetadata(Token);
			const usageCountColumn = tokenMeta.properties.usageCount?.fieldNames?.[0] ?? 'usageCount';

			await this.mikroOrmTokenRepository.nativeUpdate({ id: tokenId }, {
				lastUsedAt: new Date(),
				usageCount: raw('?? + 1', [usageCountColumn])
			} as Partial<Token>);
			return;
		}

		const usageCountColumn = this.typeOrmTokenRepository.metadata.findColumnWithPropertyName('usageCount');
		const escapedUsageCountColumn = this.typeOrmTokenRepository.manager.connection.driver.escape(
			usageCountColumn?.databaseName ?? 'usageCount'
		);

		await this.typeOrmTokenRepository
			.createQueryBuilder()
			.update(Token)
			.set({
				lastUsedAt: new Date(),
				usageCount: () => `${escapedUsageCountColumn} + 1`
			})
			.where('id = :tokenId', { tokenId })
			.execute();
	}

	async revokeAllByUserAndType(
		userId: string,
		tokenType: string,
		revokedById?: IUser['id'],
		reason?: string
	): Promise<number> {
		const result = await this.update(
			{ userId, tokenType, status: TokenStatus.ACTIVE },
			{ status: TokenStatus.REVOKED, revokedAt: new Date(), revokedById, revokedReason: reason }
		);
		return result?.['id'] || result?.['affected'] || 0;
	}

	async revokeInactiveTokens(tokenType: string, inactivityThresholdMs: number): Promise<number> {
		const thresholdDate = new Date(Date.now() - inactivityThresholdMs);
		const result = await this.update(
			{ tokenType, status: TokenStatus.ACTIVE, lastUsedAt: LessThan(thresholdDate) },
			{ status: TokenStatus.REVOKED, revokedAt: new Date(), revokedReason: 'Inactivity timeout' }
		);
		return result?.['id'] || result?.['affected'] || 0;
	}

	async markExpiredTokens(): Promise<number> {
		const result = await this.update(
			{ status: TokenStatus.ACTIVE, expiresAt: LessThan(new Date()) },
			{ status: TokenStatus.EXPIRED }
		);
		return result?.['id'] || result?.['affected'] || 0;
	}

	// -- Query ----------------------------------------------------------------

	async query(filters: ITokenFilters, limit = 100, offset = 0): Promise<ITokenQueryResult> {
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

		return this.paginate({ where, take: limit, skip: offset, order: { createdAt: 'DESC' } });
	}

	async deleteOlderThan(date: Date, status?: TokenStatus[]): Promise<number> {
		const where: any = { createdAt: LessThan(date) };
		if (status?.length) where.status = In(status);
		const result = await this.delete(where);
		return result?.['id'] || result?.['affected'] || 0;
	}

	// -- Transaction ----------------------------------------------------------

	async transaction<T>(work: (repository: ITokenRepository) => Promise<T>): Promise<T> {
		if (this.ormType === MultiORMEnum.TypeORM) {
			return this.typeOrmTokenRepository.manager.transaction(async (em: EntityManager) => {
				return work(buildTypeOrmAdapter(em.getRepository(Token)));
			});
		}

		return this.mikroOrmTokenRepository.getEntityManager().transactional(async (em) => {
			return work(buildMikroOrmAdapter(em.getRepository(Token)));
		});
	}
}
