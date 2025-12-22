import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { IUser } from '@gauzy/contracts';
import { AuthService } from '../auth.service';
import { EmployeeService } from '../../employee/employee.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	public loggingEnabled: boolean = false;

	constructor(private readonly _authService: AuthService, private readonly _employeeService: EmployeeService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET
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
			const { id, thirdPartyId, employeeId } = payload;

			if (this.loggingEnabled) console.log('Validate JWT payload:', payload);

			// We use this to also attach the user object to the request context.
			const user: IUser = await this._authService.getAuthenticatedUser(id, thirdPartyId);

			if (!user) {
				return done(new UnauthorizedException('unauthorized'), false);
			} else {
				// Check if employeeId exists in payload
				if (employeeId) {
					// Verify that the employeeId from JWT belongs to this user
					// This is a security check - the employee must exist and belong to this user
					const jwtEmployee = await this._employeeService.findOneByIdString(employeeId);

					if (!jwtEmployee || jwtEmployee.userId !== user.id) {
						return done(new UnauthorizedException('unauthorized'), false);
					}

					// Now get the employee for the current organization context (from Organization-Id header)
					// This allows users with multiple employees across organizations to work correctly
					const currentOrgEmployee = await this._employeeService.findOneByUserId(user.id);

					// Assign the current organization's employeeId (or the JWT one if no org context)
					user.employeeId = currentOrgEmployee ? currentOrgEmployee.id : employeeId;
				}

				// You could add a function to the authService to verify the claims of the token:
				// i.e. does the user still have the roles that are claimed by the token
				// const validClaims = await this.authService.verifyTokenClaims(payload);

				// if (!validClaims) {
				// 	return done(new UnauthorizedException('invalid token claims'), false);
				// }

				done(null, user);
			}
		} catch (error) {
			console.error('Error occurred during JWT validation:', error);
			return done(new UnauthorizedException('unauthorized', error.message), false);
		}
	}
}
