import { IUser } from '@gauzy/contracts';
import { IToken, ITokenFilters, ITokenQueryResult, TokenStatus } from './token.interface';

export interface ITokenReadRepository {
	/**
	 * Find a token by its hash with pessimistic locking for atomic updates
	 */
	findByHashWithLock(tokenHash: string): Promise<IToken | null>;

	/**
	 * Find a token by its hash without locking
	 */
	findByHash(tokenHash: string): Promise<IToken | null>;

	/**
	 * Find a token by ID
	 */
	findById(id: string): Promise<IToken | null>;

	/**
	 * Find active tokens for a user by token type
	 */
	findActiveByUserAndType(userId: string, tokenType: string): Promise<IToken[]>;

	/**
	 * Query tokens with filters and pagination
	 */
	query(filters: ITokenFilters, limit?: number, offset?: number): Promise<ITokenQueryResult>;
}

export interface ITokenWriteRepository {
	/**
	 * Create and save a new token
	 */
	create(tokenData: Partial<IToken>): Promise<IToken>;

	/**
	 * Save an existing token (for updates)
	 */
	save(token: IToken): Promise<IToken>;

	/**
	 * Update token status atomically with optimistic locking
	 */
	updateStatus(
		tokenId: string,
		status: TokenStatus,
		version: number,
		additionalData?: Partial<IToken>
	): Promise<boolean>;

	/**
	 * Update last used timestamp atomically
	 */
	updateLastUsed(tokenId: string): Promise<void>;

	/**
	 * Revoke all active tokens for a user by type
	 */
	revokeAllByUserAndType(
		userId: string,
		tokenType: string,
		revokedById?: IUser['id'],
		reason?: string
	): Promise<number>;

	/**
	 * Execute in transaction
	 */
	transaction<T>(work: (repository: ITokenReadRepository & ITokenWriteRepository) => Promise<T>): Promise<T>;
}

export interface ITokenMaintenanceRepository {
	/**
	 * Revoke inactive tokens based on threshold
	 */
	revokeInactiveTokens(tokenType: string, threshold: number): Promise<number>;

	/**
	 * Mark expired tokens as expired
	 */
	markExpiredTokens(): Promise<number>;

	/**
	 * Delete tokens older than specified date (for cleanup)
	 */
	deleteOlderThan(date: Date, status?: TokenStatus[]): Promise<number>;
}

export type ITokenRepository = ITokenReadRepository & ITokenWriteRepository & ITokenMaintenanceRepository;
