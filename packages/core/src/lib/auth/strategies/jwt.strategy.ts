import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { IAuthenticatedUser } from '../../core/context/types';
import { AuthService } from '../auth.service';
import { isAccessTokenPayload, JWT_ALGORITHMS } from '../purpose-token';
import { EmployeeService } from '../../employee/employee.service';
import { RoleAuthorizationService } from '../../role/role-authorization.service';
import { UserOrganizationService } from '../../user-organization/user-organization.services';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	private readonly logger = new Logger(JwtStrategy.name);
	public loggingEnabled: boolean = false;

	constructor(
		private readonly _authService: AuthService,
		private readonly _employeeService: EmployeeService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _roleAuthorizationService: RoleAuthorizationService
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET,
			algorithms: JWT_ALGORITHMS
		});
	}

	/**
	 * Validates the JWT payload.
	 * @param {JwtPayload} payload - The JWT payload to validate.
	 * @param {Function} done - The callback function to call when validation is complete.
	 * @returns {void}
	 */
	async validate(payload: JwtPayload, done: (err: unknown, user?: unknown) => void): Promise<void> {
		try {
			const { id, thirdPartyId, employeeId, organizationId, tenantId } = payload;

			if (this.loggingEnabled) {
				this.logger.debug(`Validate JWT payload for user: ${payload?.id}`);
			}

			// An access token identifies its user by `id` (or `thirdPartyId`). Other JWTs are signed
			// with the same JWT_SECRET but carry no such claim (invite, estimate, team-join,
			// appointment, magic-code tokens); a lookup by an undefined id used to fall through to
			// the FIRST user in the table, so such a token authenticated as that user. Reject them here.
			if (!id && !thirdPartyId) {
				return done(new UnauthorizedException('unauthorized'), false);
			}

			// A purpose-typed token (password reset, workspace sign-in, ...) is not an access token even
			// when it carries an `id`: the password-reset token does (GHSA-28wv-vrxj-rp4q).
			if (!isAccessTokenPayload(payload)) {
				return done(new UnauthorizedException('unauthorized'), false);
			}

			// We use this to also attach the user object to the request context.
			const user: IAuthenticatedUser = await this._authService.getAuthenticatedUser(id, thirdPartyId);

			// A token outlives the account it was issued for. Deactivating or archiving a user is an
			// off-boarding or incident-response control, and it has to end the session on the NEXT request
			// rather than whenever the token happens to expire (up to JWT_TOKEN_EXPIRATION_TIME, 24h by
			// default). These are the exact predicates (`isActive: true, isArchived: false`) that `login()`
			// and `getJwtAccessToken()` already apply at issuance, so no one who holds a token today is
			// locked out by them — and an account whose status is unknown (NULL) is refused, as it is there.
			if (!user || user.isActive !== true || user.isArchived !== false) {
				return done(new UnauthorizedException('unauthorized'), false);
			}

			// Pin the role and permissions the user holds RIGHT NOW onto the request. Every
			// RequestContext.hasRoles/hasPermissions check during this request reads them instead of the
			// `role` / `permissions` claims frozen into the token, so a demotion also takes effect on the
			// next request. If the role cannot be resolved the user gets none — authorization fails closed.
			await this._roleAuthorizationService.attachAuthorizationState(user);

			// Validate the employee/organization claims and attach them to the user.
			const contextError = await this.attachEmployeeAndOrganizationContext(user, {
				employeeId,
				organizationId,
				tenantId
			});

			if (contextError) {
				return done(contextError, false);
			}

			if (this.loggingEnabled) {
				this.logger.debug(`Getting user tenantId from JWT strategy: ${user.tenantId ?? 'undefined'}`);
			}
			done(null, user);
		} catch (error) {
			this.logger.error(`Error occurred during JWT validation: ${error?.message}`, error?.stack, 'JwtStrategy');
			return done(new UnauthorizedException('unauthorized', error.message), false);
		}
	}

	/**
	 * Validate the `employeeId` / `organizationId` claims of an access token and attach them to the
	 * authenticated user.
	 *
	 * Both claims are frozen into the token at issuance, so each one is re-resolved against the
	 * database on every request: a deactivated or archived employee record, an employee that belongs
	 * to another user or another organization, and an organization the user is no longer a member of
	 * all stop granting the context the token was minted with.
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

		// Validate and assign employeeId from JWT
		let validatedEmployee = null;
		if (employeeId) {
			const employee = await this._employeeService.findOneByIdString(employeeId);

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

			const userOrganization = await this._userOrganizationService.findOneByOptions({
				where: {
					userId: user.id,
					organizationId,
					tenantId: tenantId || user.tenantId,
					isActive: true,
					isArchived: false
				}
			});

			if (!userOrganization) {
				return new UnauthorizedException('User does not have access to organization');
			}

			user.lastOrganizationId = organizationId;
		}

		return null;
	}
}
