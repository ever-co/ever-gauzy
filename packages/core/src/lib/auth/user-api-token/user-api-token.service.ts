import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull } from 'typeorm';
import { environment } from '@gauzy/config';
import { ID, IPagination, IUserApiTokenExchangeInput, IUserApiTokenExchangeResponse } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { TenantAwareCrudService } from '../../core/crud/tenant-aware-crud.service';
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailableError } from '../../core/errors/database-unavailable';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../../core/utils';
import { AuthService } from '../auth.service';
import { assertFirstPartyRequest } from '../oauth-app-first-party';
import { CreateUserApiTokenDTO, UserApiTokenResponseDTO, UserApiTokenWithSecretResponseDTO } from './dto/user-api-token.dto';
import { MikroOrmUserApiTokenRepository } from './repository/mikro-orm-user-api-token.repository';
import { TypeOrmUserApiTokenRepository } from './repository/type-orm-user-api-token.repository';
import { UserApiToken } from './user-api-token.entity';
import {
	generateUserApiToken,
	hashUserApiToken,
	isWellFormedUserApiToken,
	MAX_ACTIVE_USER_API_TOKENS,
	resolveUserApiTokenExpiry,
	USER_API_TOKEN_LAST_USED_RESOLUTION_MS,
	USER_API_TOKEN_SESSION_TTL_MS,
	userApiTokenDisplayPrefix,
	userApiTokenHashesMatch
} from './user-api-token.utils';

/** A refusal already logged with its reason, on its way to the one answer every refusal gets. */
class ExchangeRefused extends Error {}

/**
 * Personal API tokens: a long-lived credential a user creates in Settings and hands to an agent or a script.
 *
 * **It is never accepted on a route.** It is exchanged (`POST /api/auth/api-token/exchange`) for an ordinary access
 * token, minted by the code every sign-in mints through and judged by `JwtStrategy` like any other. So no guard knows
 * about API tokens, and the token holds exactly the role and permissions of its user at the time of each request.
 *
 * **Every read and write here is the caller's own.** Each one states the signed-in user's id and the tenant, and there
 * is no route to anyone else's tokens. A tenant administrator revoking another person's tokens is not built yet.
 *
 * **Only a person in their own session manages tokens.** `assertFirstPartyRequest` refuses a third-party OAuth-app
 * token and a session that came from an API token, so a leaked token cannot make another one for itself.
 */
@Injectable()
export class UserApiTokenService extends TenantAwareCrudService<UserApiToken> {
	private readonly logger = new Logger(UserApiTokenService.name);

	constructor(
		readonly typeOrmUserApiTokenRepository: TypeOrmUserApiTokenRepository,
		readonly mikroOrmUserApiTokenRepository: MikroOrmUserApiTokenRepository,
		private readonly authService: AuthService
	) {
		super(typeOrmUserApiTokenRepository, mikroOrmUserApiTokenRepository);
	}

	/**
	 * The signed-in user's tokens, without the revoked ones and without any secret.
	 *
	 * @returns Their tokens, newest first.
	 */
	async listOwn(): Promise<IPagination<UserApiTokenResponseDTO>> {
		assertFirstPartyRequest('Listing API tokens');

		const items = (await this.find({
			where: { userId: this.currentUserIdOrFail(), revokedAt: IsNull() },
			order: { createdAt: 'DESC' },
			take: 100
		})).map((row) => UserApiTokenResponseDTO.fromEntity(row));

		return { items, total: items.length };
	}

	/**
	 * Creates a token for the signed-in user.
	 *
	 * @param input Its name and how long it stays valid.
	 * @returns The row and, this one time, the plain token. Only its hash is stored.
	 * @throws BadRequestException when the user already holds {@link MAX_ACTIVE_USER_API_TOKENS} working tokens.
	 */
	async createOwn(input: CreateUserApiTokenDTO): Promise<UserApiTokenWithSecretResponseDTO> {
		assertFirstPartyRequest('Creating an API token');

		const userId = this.currentUserIdOrFail();
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new UnauthorizedException();
		}

		const now = new Date();
		const tooMany = () =>
			new BadRequestException(
				`You can hold ${MAX_ACTIVE_USER_API_TOKENS} API tokens at once. Revoke one you no longer use first.`
			);
		if ((await this.countActive(userId, now)) >= MAX_ACTIVE_USER_API_TOKENS) {
			throw tooMany();
		}

		const token = generateUserApiToken();
		const row = await this.create({
			userId,
			tenantId,
			name: input.name,
			tokenHash: hashUserApiToken(token),
			prefix: userApiTokenDisplayPrefix(token),
			expiresAt: resolveUserApiTokenExpiry(input.expiry, now),
			lastUsedAt: null,
			revokedAt: null
		});

		// Counted again now that the row is there: two creates in parallel both passed the check above. Neither has shown
		// its token yet, so the one that finds too many takes its row back. Both can, and then the user just tries again:
		// the limit holds on every database without a lock.
		if ((await this.countActive(userId, new Date())) > MAX_ACTIVE_USER_API_TOKENS) {
			await this.update({ id: row.id, userId }, { revokedAt: new Date() });
			throw tooMany();
		}

		this.logger.log(`API token created: id=${row.id} userId=${userId} tenantId=${tenantId}`);

		return UserApiTokenWithSecretResponseDTO.fromCreated(row, token);
	}

	/**
	 * Revokes one of the signed-in user's tokens. An access token it was already exchanged for keeps working until it
	 * expires, within {@link USER_API_TOKEN_SESSION_TTL_MS}.
	 *
	 * @param id The token's id.
	 * @throws NotFoundException when the id is not a live token of this user, whoever else's it may be.
	 */
	async revokeOwn(id: ID): Promise<void> {
		assertFirstPartyRequest('Revoking an API token');

		const userId = this.currentUserIdOrFail();
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new UnauthorizedException();
		}

		const [row] = await this.find({ where: { id, userId, revokedAt: IsNull() } });
		if (!row) {
			throw new NotFoundException();
		}

		await this.update({ id, userId }, { revokedAt: new Date() });

		this.logger.log(`API token revoked: id=${id} userId=${userId} tenantId=${tenantId}`);
	}

	/**
	 * Exchanges an API token for an ordinary short-lived access token.
	 *
	 * Every refusal is the same 401 and logs its reason here only: a caller cannot tell a token that never existed from
	 * a revoked one or from one whose owner left. The token, the digest and the prefix of an unknown token are never
	 * logged. A database that cannot be reached answers 503, as `JwtStrategy` does: the token was not judged, and a 401
	 * would tell the client to throw a good token away.
	 *
	 * @param input The token and, optionally, the organization to work in.
	 * @returns The access token.
	 * @throws UnauthorizedException for any token that does not earn a session.
	 */
	async exchange(input: IUserApiTokenExchangeInput): Promise<IUserApiTokenExchangeResponse> {
		try {
			return await this.judgeAndMint(input);
		} catch (error) {
			if (isDatabaseUnavailableError(error)) {
				this.logger.error(`API token exchange could not reach the database: ${error?.message}`);
				throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: error });
			}
			if (!(error instanceof ExchangeRefused)) {
				this.logger.warn(`API token exchange refused: ${error?.message}`);
			}
			throw new UnauthorizedException();
		}
	}

	/**
	 * The checks of an exchange, then the mint.
	 *
	 * Whether the user is still active and not archived or deleted, and whether an employee was ended, is judged by
	 * `AuthService.issueUserApiTokenSession` with the rules of every sign-in, at every exchange.
	 */
	private async judgeAndMint({ token, organizationId }: IUserApiTokenExchangeInput): Promise<IUserApiTokenExchangeResponse> {
		const refuse: (reason: string, row?: UserApiToken) => never = (reason, row) => {
			this.logger.warn(`API token exchange refused: ${reason}${row ? ` id=${row.id}` : ''}`);
			throw new ExchangeRefused(reason);
		};

		if (!isWellFormedUserApiToken(token)) {
			refuse('malformed token');
		}
		if (organizationId !== undefined && organizationId !== null && !isUUID(organizationId)) {
			refuse('malformed organization');
		}

		const presented = hashUserApiToken(token);
		const row = await this.findByHash(presented);
		if (!row || !userApiTokenHashesMatch(row.tokenHash, presented)) {
			refuse('unknown token');
		}

		const now = new Date();
		if (row.revokedAt) {
			refuse('revoked', row);
		}
		if (this.hasExpired(row, now)) {
			refuse('expired', row);
		}
		if (!row.tenantId || !row.userId) {
			refuse('no owner', row);
		}

		const accessToken = await this.authService.issueUserApiTokenSession({
			userId: row.userId,
			tenantId: row.tenantId,
			apiTokenId: row.id,
			organizationId: organizationId || undefined,
			expiresAt: this.sessionExpiry(row, now)
		});

		await this.recordUse(row, now);

		this.logger.log(`API token exchanged: id=${row.id} userId=${row.userId} tenantId=${row.tenantId}`);

		return { token: accessToken };
	}

	/**
	 * Reads a token by its digest. Straight from the repository: the route is public, so there is no tenant to scope
	 * by, and the tenant comes from the row.
	 */
	private async findByHash(tokenHash: string): Promise<UserApiToken | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<UserApiToken>({ where: { tokenHash } });
				return (await this.mikroOrmRepository.findOne(where, mikroOptions)) as UserApiToken | null;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.findOne({ where: { tokenHash } });
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}

	/** Records the use, at most once per {@link USER_API_TOKEN_LAST_USED_RESOLUTION_MS}. It never fails an exchange. */
	private async recordUse(row: UserApiToken, now: Date): Promise<void> {
		const last = row.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
		if (now.getTime() - last < USER_API_TOKEN_LAST_USED_RESOLUTION_MS) {
			return;
		}
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					await this.mikroOrmRepository.nativeUpdate({ id: row.id } as any, { lastUsedAt: now } as any);
					break;
				case MultiORMEnum.TypeORM:
					await this.typeOrmRepository.update({ id: row.id }, { lastUsedAt: now });
					break;
				default:
					throw new Error(`ORM type not implemented: ${this.ormType}`);
			}
		} catch (error) {
			this.logger.warn(`Could not record the use of API token ${row.id}: ${error?.message}`);
		}
	}

	/**
	 * When the access token of an exchange expires: within the session lifetime, never after the API token itself, and
	 * never later than a sign-in's access token on this server.
	 */
	private sessionExpiry(row: UserApiToken, now: Date): Date {
		const signInTtlMs = Number(environment.JWT_TOKEN_EXPIRATION_TIME) * 1000 || USER_API_TOKEN_SESSION_TTL_MS;
		const limits = [now.getTime() + Math.min(USER_API_TOKEN_SESSION_TTL_MS, signInTtlMs)];
		if (row.expiresAt) {
			limits.push(new Date(row.expiresAt).getTime());
		}
		return new Date(Math.min(...limits));
	}

	/** How many working tokens the user holds. Read here and not by SQL, so that a date compares alike on every database. */
	private async countActive(userId: ID, now: Date): Promise<number> {
		const held = await this.find({ where: { userId, revokedAt: IsNull() } });
		return held.filter((row) => !this.hasExpired(row, now)).length;
	}

	private hasExpired(row: UserApiToken, now: Date): boolean {
		return !!row.expiresAt && new Date(row.expiresAt).getTime() <= now.getTime();
	}

	private currentUserIdOrFail(): ID {
		const userId = RequestContext.currentUserId();
		if (!userId) {
			throw new UnauthorizedException();
		}
		return userId;
	}
}
