import { LockMode, raw } from '@mikro-orm/core';
import { Between, In, LessThan, MoreThan, Repository } from 'typeorm';
import { Token } from '../entities/token.entity';
import { ITokenFilters, ITokenRepository, TokenStatus } from '../interfaces';

// ---------------------------------------------------------------------------
// Helpers: build a thin ITokenRepository adapter from a raw ORM repository.
// These keep the transaction() method lean and ensure logic lives in one place.
// ---------------------------------------------------------------------------

export function buildTypeOrmAdapter(repo: Repository<Token>): ITokenRepository {
	const usageCountColumn = repo.metadata.findColumnWithPropertyName('usageCount');
	const escapedUsageCountColumn = repo.manager.connection.driver.escape(
		usageCountColumn?.databaseName ?? 'usageCount'
	);

	const buildWhere = (filters: ITokenFilters) => {
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
		return where;
	};

	const adapter: ITokenRepository = {
		findByHashWithLock: (tokenHash) =>
			repo
				.createQueryBuilder('token')
				.where('token.tokenHash = :tokenHash', { tokenHash })
				.setLock('pessimistic_write')
				.getOne(),

		findByHash: (tokenHash) => repo.findOne({ where: { tokenHash } }),

		findById: (id) => repo.findOne({ where: { id } }),

		findActiveByUserAndType: (userId, tokenType) =>
			repo.find({ where: { userId, tokenType, status: TokenStatus.ACTIVE }, order: { createdAt: 'DESC' } }),

		create: async (tokenData) => {
			const token = repo.create(tokenData);
			return repo.save(token);
		},

		save: (token) => repo.save(token),

		updateStatus: async (tokenId, status, version, additionalData) => {
			const updateData = { status, ...additionalData };
			if (status === TokenStatus.REVOKED) updateData.revokedAt = new Date();
			const result = await repo.update({ id: tokenId, version }, updateData);
			return result?.['id'] || result?.['affected'] === 1;
		},

		updateLastUsed: async (tokenId) => {
			await repo
				.createQueryBuilder()
				.update(Token)
				.set({ lastUsedAt: new Date(), usageCount: () => `${escapedUsageCountColumn} + 1` })
				.where('id = :tokenId', { tokenId })
				.execute();
		},

		revokeAllByUserAndType: async (userId, tokenType, revokedById?, reason?) => {
			const result = await repo.update(
				{ userId, tokenType, status: TokenStatus.ACTIVE },
				{ status: TokenStatus.REVOKED, revokedAt: new Date(), revokedById, revokedReason: reason }
			);
			return result?.['id'] || result?.['affected'] || 0;
		},

		revokeInactiveTokens: async (tokenType, inactivityThresholdMs) => {
			const thresholdDate = new Date(Date.now() - inactivityThresholdMs);
			const result = await repo.update(
				{ tokenType, status: TokenStatus.ACTIVE, lastUsedAt: LessThan(thresholdDate) },
				{ status: TokenStatus.REVOKED, revokedAt: new Date(), revokedReason: 'Inactivity timeout' }
			);
			return result?.['id'] || result?.['affected'] || 0;
		},

		markExpiredTokens: async () => {
			const result = await repo.update(
				{ status: TokenStatus.ACTIVE, expiresAt: LessThan(new Date()) },
				{ status: TokenStatus.EXPIRED }
			);
			return result?.['id'] || result?.['affected'] || 0;
		},

		query: async (filters, limit = 100, offset = 0) => {
			const [items, total] = await repo.findAndCount({
				where: buildWhere(filters),
				take: limit,
				skip: offset,
				order: { createdAt: 'DESC' }
			});
			return { items, total };
		},

		deleteOlderThan: async (date, status?) => {
			const where: any = { createdAt: LessThan(date) };
			if (status?.length) where.status = In(status);
			const result = await repo.delete(where);
			return result?.['id'] || result?.['affected'] || 0;
		},

		// Nested calls re-use the same adapter (already inside a transaction).
		transaction: async (work) => work(adapter)
	};

	return adapter;
}

export function buildMikroOrmAdapter(repo: any): ITokenRepository {
	const adapter: ITokenRepository = {
		findByHashWithLock: async (tokenHash) => {
			const token = await repo.findOne({ tokenHash });
			if (!token) {
				return null;
			}

			const em = repo.getEntityManager();
			await em.lock(token, LockMode.PESSIMISTIC_WRITE);
			await em.refresh(token);

			return token;
		},

		findByHash: (tokenHash) => repo.findOne({ tokenHash }),

		findById: (id) => repo.findOne(id),

		findActiveByUserAndType: (userId, tokenType) => repo.find({ userId, tokenType, status: TokenStatus.ACTIVE }),

		create: async (tokenData) => {
			const token = repo.create(tokenData);
			await repo.insert(token);
			return token;
		},

		save: (token) => repo.upsert(token),

		updateStatus: async (tokenId, status, version, additionalData) => {
			const updateData = { status, ...additionalData };
			if (status === TokenStatus.REVOKED) updateData.revokedAt = new Date();
			const affected = await repo.nativeUpdate({ id: tokenId, version }, updateData);
			return !!affected;
		},

		updateLastUsed: async (tokenId) => {
			const em = repo.getEntityManager();
			const tokenMeta = em.getMetadata(Token);
			const usageCountColumn = tokenMeta.properties.usageCount?.fieldNames?.[0] ?? 'usageCount';

			await repo.nativeUpdate(
				{ id: tokenId },
				{
					lastUsedAt: new Date(),
					usageCount: raw('?? + 1', [usageCountColumn])
				}
			);
		},

		revokeAllByUserAndType: async (userId, tokenType, revokedById?, reason?) => {
			const affected = await repo.nativeUpdate(
				{ userId, tokenType, status: TokenStatus.ACTIVE },
				{ status: TokenStatus.REVOKED, revokedAt: new Date(), revokedById, revokedReason: reason }
			);
			return affected || 0;
		},

		revokeInactiveTokens: async (tokenType, inactivityThresholdMs) => {
			const thresholdDate = new Date(Date.now() - inactivityThresholdMs);
			const affected = await repo.nativeUpdate(
				{ tokenType, status: TokenStatus.ACTIVE, lastUsedAt: { $lt: thresholdDate } },
				{ status: TokenStatus.REVOKED, revokedAt: new Date(), revokedReason: 'Inactivity timeout' }
			);
			return affected || 0;
		},

		markExpiredTokens: async () => {
			const affected = await repo.nativeUpdate(
				{ status: TokenStatus.ACTIVE, expiresAt: { $lt: new Date() } },
				{ status: TokenStatus.EXPIRED }
			);
			return affected || 0;
		},

		query: async (filters, limit = 100, offset = 0) => {
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
			const [items, total] = await repo.findAndCount(where, {
				limit,
				offset,
				orderBy: { createdAt: 'DESC' }
			});
			return { items, total };
		},

		deleteOlderThan: async (date, status?) => {
			const where: any = { createdAt: { $lt: date } };
			if (status?.length) where.status = { $in: status };
			const affected = await repo.nativeDelete(where);
			return affected || 0;
		},

		transaction: async (work) => work(adapter)
	};

	return adapter;
}
