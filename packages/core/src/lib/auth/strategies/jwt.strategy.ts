import { Injectable, Logger, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { IAuthenticatedUser } from '../../core/context/types';
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailableError } from '../../core/errors/database-unavailable';
import { AuthService } from '../auth.service';
import { isAccessTokenPayload, JWT_ALGORITHMS } from '../purpose-token';
import { EmployeeService } from '../../employee/employee.service';
import { RoleAuthorizationService } from '../../role/role-authorization.service';
import { UserOrganizationService } from '../../user-organization/user-organization.services';
import { AuthenticatedUserCache } from './authenticated-user-cache';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	private readonly logger = new Logger(JwtStrategy.name);
	public loggingEnabled: boolean = false;

	/** The validated contexts of recently seen tokens (see {@link AuthenticatedUserCache}). */
	private readonly authenticatedUsers: AuthenticatedUserCache;

	constructor(
		private readonly _authService: AuthService,
		private readonly _employeeService: EmployeeService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _roleAuthorizationService: RoleAuthorizationService,
		@Optional() authenticatedUsers?: AuthenticatedUserCache
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET,
			algorithms: JWT_ALGORITHMS
		});
		this.authenticatedUsers = authenticatedUsers ?? new AuthenticatedUserCache();
	}

	/**
	 * Validates the JWT payload.
	 *
	 * Passport contract (`@nestjs/passport`'s `PassportStrategy` mixin): the value returned here is handed
	 * to passport as the authenticated user, and a thrown exception is handed to it as the error. The mixin
	 * owns passport's `done` callback and calls it exactly once with the outcome; this method must not
	 * call it too. It used to — `done(null, user)` and then an implicit `return undefined` — so every
	 * authenticated request reported to passport twice: a success, then a `fail()` that Nest's AuthGuard
	 * answered by constructing and throwing an `UnauthorizedException` nobody would ever see, and that
	 * overwrote `request.authInfo`.
	 *
	 * @param {JwtPayload} payload - The JWT payload to validate.
	 * @returns {Promise<IAuthenticatedUser>} The authenticated user.
	 * @throws {UnauthorizedException} When the token does not authenticate a user.
	 * @throws {ServiceUnavailableException} When the database could not be reached to judge the token.
	 */
	async validate(payload: JwtPayload): Promise<IAuthenticatedUser> {
		let outcome: IAuthenticatedUser | UnauthorizedException;
		try {
			outcome = await this.resolveAuthenticatedUser(payload);
		} catch (error) {
			this.logger.error(`Error occurred during JWT validation: ${error?.message}`, error?.stack, 'JwtStrategy');
			// The token was never judged: the database could not be reached (pool exhausted, connection lost,
			// server restarting). A 401 would tell the client its valid token is bad, so it would drop it and
			// re-authenticate, multiplying the load that caused the outage; a 503 is retried with the same token.
			if (isDatabaseUnavailableError(error)) {
				throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: error });
			}
			// Logged above and kept as the cause; never sent: it can name database, DNS or TLS internals (CWE-209).
			throw new UnauthorizedException('unauthorized', { cause: error });
		}

		// A refusal decided by `resolveAuthenticatedUser` is passed on exactly as it was built, never
		// re-wrapped by the catch above, which is only for a lookup that FAILED.
		if (outcome instanceof UnauthorizedException) {
			throw outcome;
		}
		return outcome;
	}

	/**
	 * Resolves the user a JWT payload authenticates.
	 *
	 * @param payload - The JWT payload to validate.
	 * @returns The authenticated user, or the `UnauthorizedException` that refuses the token. A refusal is
	 * RETURNED rather than thrown, so that `validate` can tell it apart from a lookup that threw.
	 */
	private async resolveAuthenticatedUser(payload: JwtPayload): Promise<IAuthenticatedUser | UnauthorizedException> {
		const { id, thirdPartyId, employeeId, organizationId, tenantId } = payload;

		if (this.loggingEnabled) {
			this.logger.debug(`Validate JWT payload for user: ${payload?.id}`);
		}

		// An access token identifies its user by `id` (or `thirdPartyId`). Other JWTs are signed
		// with the same JWT_SECRET but carry no such claim (invite, estimate, team-join,
		// appointment, magic-code tokens); a lookup by an undefined id used to fall through to
		// the FIRST user in the table, so such a token authenticated as that user. Reject them here.
		if (!id && !thirdPartyId) {
			return new UnauthorizedException('unauthorized');
		}

		// A purpose-typed token (password reset, workspace sign-in, ...) is not an access token even
		// when it carries an `id`: the password-reset token does (GHSA-28wv-vrxj-rp4q).
		if (!isAccessTokenPayload(payload)) {
			return new UnauthorizedException('unauthorized');
		}

		// The rest reads the database. A context validated moments ago for the same claims is reused, and
		// concurrent requests with the same claims share one lookup (JWT_AUTHENTICATED_USER_TTL_MS; 0 judges every
		// request afresh). Only a context that authenticated is reused: a refusal is never remembered.
		return this.authenticatedUsers.resolve({ id, thirdPartyId, employeeId, organizationId, tenantId }, () =>
			this.loadAuthenticatedUser(payload)
		);
	}

	/**
	 * Judges an access token against the database: the user it names, the role and permissions they hold now,
	 * and the employee and organization membership the token claims.
	 *
	 * @param payload - The JWT payload, already known to be an access token that names a user.
	 * @returns The authenticated user, or the `UnauthorizedException` that refuses the token.
	 */
	private async loadAuthenticatedUser(payload: JwtPayload): Promise<IAuthenticatedUser | UnauthorizedException> {
		const { id, thirdPartyId, employeeId, organizationId, tenantId } = payload;

		// We use this to also attach the user object to the request context.
		const user: IAuthenticatedUser = await this._authService.getAuthenticatedUser(id, thirdPartyId);

		// A token outlives the account it was issued for. Deactivating or archiving a user is an
		// off-boarding or incident-response control, and it has to end the session on the next request
		// that is judged (the next one unless JWT_AUTHENTICATED_USER_TTL_MS is set) rather than whenever the
		// token happens to expire (up to JWT_TOKEN_EXPIRATION_TIME, 24h by default). These are the exact
		// predicates (`isActive: true, isArchived: false`) that `login()`
		// and `getJwtAccessToken()` already apply at issuance, so no one who holds a token today is
		// locked out by them — and an account whose status is unknown (NULL) is refused, as it is there.
		if (!user || user.isActive !== true || user.isArchived !== false) {
			return new UnauthorizedException('unauthorized');
		}

		// Pin the role and permissions the user holds RIGHT NOW onto the request. Every
		// RequestContext.hasRoles/hasPermissions check during this request reads them instead of the
		// `role` / `permissions` claims frozen into the token, so a demotion also takes effect on the
		// next request that is judged. If the role cannot be resolved the user gets none — authorization
		// fails closed.
		await this._roleAuthorizationService.attachAuthorizationState(user);

		// Validate the employee/organization claims and attach them to the user.
		const contextError = await this.attachEmployeeAndOrganizationContext(user, {
			employeeId,
			organizationId,
			tenantId
		});

		if (contextError) {
			return contextError;
		}

		if (this.loggingEnabled) {
			this.logger.debug(`Getting user tenantId from JWT strategy: ${user.tenantId ?? 'undefined'}`);
		}
		return user;
	}

	/**
	 * Validate the `employeeId` / `organizationId` claims of an access token and attach them to the
	 * authenticated user.
	 *
	 * Both claims are frozen into the token at issuance, so each one is re-resolved against the
	 * database whenever the token is judged: a deactivated or archived employee record, an employee that
	 * belongs to another user or another organization, and an organization the user is no longer a member
	 * of all stop granting the context the token was minted with.
	 *
	 * The two lookups are independent — each reads only the token's claims and the user's `id` / `tenantId`,
	 * which neither of them changes — so both are issued up front and run concurrently: one database round
	 * trip of latency instead of two when a token carries both claims. Their OUTCOMES are still judged one
	 * after the other in the original order (employee record, then the cross-check, then membership), so a
	 * token that fails several checks is refused with exactly the exception it always was — including when
	 * a lookup itself throws: the employee lookup's error is still the one that propagates.
	 *
	 * @param user - The authenticated user, mutated with the validated claims.
	 * @param claims - The `employeeId`, `organizationId` and `tenantId` claims of the token.
	 * @returns The `UnauthorizedException` that rejects the request, or `null` when both claims pass.
	 */
	private async attachEmployeeAndOrganizationContext(
		user: IAuthenticatedUser,
		claims: { employeeId?: string; organizationId?: string; tenantId?: string }
	): Promise<UnauthorizedException | null> {
		const { employeeId, organizationId, tenantId } = claims;

		const employeeLookup = employeeId ? this._employeeService.findOneByIdString(employeeId) : null;
		const membershipLookup = organizationId
			? this._userOrganizationService.findOneByOptions({
					where: {
						userId: user.id,
						organizationId,
						tenantId: tenantId || user.tenantId,
						isActive: true,
						isArchived: false
					}
				})
			: null;
		// The membership lookup is not awaited when the employee check refuses the token first (or its
		// lookup throws); a rejection it settles with then is moot, and must not surface as unhandled.
		membershipLookup?.catch(() => undefined);

		// Validate and assign employeeId from JWT
		let validatedEmployee = null;
		if (employeeId) {
			const employee = await employeeLookup;

			// Same reasoning as for the user above: a deactivated or archived employee record must not
			// keep granting the employee context its token was minted with.
			if (
				!employee ||
				employee.userId !== user.id ||
				employee.isActive !== true ||
				employee.isArchived !== false
			) {
				return new UnauthorizedException('unauthorized');
			}

			validatedEmployee = employee;
			user.employeeId = employeeId;
		}

		// Validate and assign organizationId from JWT
		if (organizationId) {
			// Cross-validate: if employeeId was provided, ensure it belongs to the claimed organization
			if (validatedEmployee && validatedEmployee.organizationId !== organizationId) {
				return new UnauthorizedException('Employee does not belong to the claimed organization');
			}

			const userOrganization = await membershipLookup;

			if (!userOrganization) {
				return new UnauthorizedException('User does not have access to organization');
			}

			user.lastOrganizationId = organizationId;
		}

		return null;
	}
}
