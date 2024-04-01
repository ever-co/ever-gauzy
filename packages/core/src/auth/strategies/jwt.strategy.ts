import { environment as env } from '@gauzy/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { IUser } from '@gauzy/contracts';
import { AuthService } from '../auth.service';
import { EmployeeService } from '../../employee/employee.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {

	constructor(
		private readonly _authService: AuthService,
		private readonly _employeeService: EmployeeService,
	) {
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
	async validate(payload: JwtPayload, done: Function): Promise<void> {
		try {
			const { id, thirdPartyId } = payload;

			// We use this to also attach the user object to the request context.
			const user: IUser = await this._authService.getAuthenticatedUser(
				id,
				thirdPartyId
			);

			if (!user) {
				return done(new UnauthorizedException('unauthorized'), false);
			} else {
				// Check if payload has employeeId
				if (payload.employeeId) {
					// If employeeId exists, retrieve employee details associated with the user
					const employee = await this._employeeService.findOneByUserId(user.id);
					// If employee is found, assign its id to user.employeeId, otherwise assign null
					user.employeeId = employee ? employee.id : null;
				}
				done(null, user);
			}
		} catch (error) {
			console.error('Error occurred during JWT validation:', error);
			return done(new UnauthorizedException('unauthorized', error.message), false);
		}
	}
}
