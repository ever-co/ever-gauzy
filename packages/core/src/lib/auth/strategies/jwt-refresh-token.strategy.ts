import { environment } from '@gauzy/config';
import { IUser } from '@gauzy/contracts';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailableError } from '../../core/errors/database-unavailable';
import { RefreshTokenService } from '../../refresh-token/refresh-token.service';
import { UserService } from './../../user/user.service';
import { JWT_ALGORITHMS } from '../purpose-token';

@Injectable()
export class JwtRefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh-token') {
	constructor(private readonly userService: UserService, private readonly refreshTokenService: RefreshTokenService) {
		super({
			jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
			secretOrKey: environment.JWT_REFRESH_TOKEN_SECRET,
			algorithms: JWT_ALGORITHMS,
			passReqToCallback: true,
			ignoreExpiration: false
		});
	}

	/**
	 * Validates the refresh token and payload to ensure user authorization.
	 *
	 * Passport contract (`@nestjs/passport`'s `PassportStrategy` mixin): the returned value is the
	 * authenticated user and a thrown exception is the error; the mixin calls passport's `done` exactly
	 * once with that outcome, so this method never calls it (see `JwtStrategy.validate`).
	 *
	 * @param request - The incoming request, expected to contain the refresh token in its body.
	 * @param payload - The JWT payload to validate.
	 * @returns The user the refresh token belongs to.
	 * @throws {UnauthorizedException} When the refresh token does not authenticate a user.
	 * @throws {ServiceUnavailableException} When the database could not be reached to judge the token.
	 */
	async validate(request: Request, payload: JwtPayload): Promise<IUser> {
		let outcome: IUser | UnauthorizedException;
		try {
			outcome = await this.resolveUser(request, payload);
		} catch (err) {
			// The refresh token was never judged: the database could not be reached. A 401 here ends the
			// session (the client discards its tokens), so an outage would sign everyone out; see JwtStrategy.
			if (isDatabaseUnavailableError(err)) {
				throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: err });
			}
			// Handle errors and provide a meaningful response
			const message = err instanceof Error ? err.message : String(err);
			throw new UnauthorizedException('Unauthorized', message);
		}

		// A refusal decided by `resolveUser` is passed on exactly as it was built, never re-wrapped above.
		if (outcome instanceof UnauthorizedException) {
			throw outcome;
		}
		return outcome;
	}

	/**
	 * Resolves the user a refresh token belongs to.
	 *
	 * @param request - The incoming request, expected to contain the refresh token in its body.
	 * @param payload - The JWT payload to validate.
	 * @returns The user, or the `UnauthorizedException` that refuses the token. A refusal is RETURNED
	 * rather than thrown, so that `validate` can tell it apart from a lookup that threw.
	 */
	private async resolveUser(request: Request, payload: JwtPayload): Promise<IUser | UnauthorizedException> {
		const { refresh_token } = request.body; // Extract the refresh token

		const { isValid, token, reason } = await this.refreshTokenService.verify(refresh_token); // Validate the refresh token against the service

		if (!isValid) {
			return new UnauthorizedException(reason ?? 'Unauthorized'); // Return unauthorized if validation fails
		}

		const verifiedUserId = token?.userId;
		const payloadUserId =
			(typeof payload?.['userId'] === 'string' && payload['userId']) ||
			(typeof payload?.['id'] === 'string' && payload['id']) ||
			(typeof payload?.sub === 'string' && payload.sub) ||
			null;

		// Defense in depth: make sure the JWT identity resolved by passport matches
		// the identity resolved by the token validation path.
		if (!verifiedUserId || (payloadUserId && payloadUserId !== verifiedUserId)) {
			return new UnauthorizedException('Unauthorized');
		}

		const user = await this.userService.findOneByIdString(verifiedUserId); // Fetch the user based on the payload ID

		// A deactivated or archived account must not be able to mint anything, and must not be
		// attached to the request context either. `getAccessTokenFromRefreshToken` happens to filter
		// on the same predicates further down the call chain today, but a refresh-route handler must
		// not inherit an authenticated identity this strategy was willing to hand out.
		// Exact predicates, as at issuance: an unknown (NULL) status is refused too.
		if (!user || user.isActive !== true || user.isArchived !== false) {
			return new UnauthorizedException('Unauthorized'); // Return unauthorized if validation fails
		}

		return user; // Return user if validation is successful
	}
}
