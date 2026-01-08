import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';
import { IUser } from '@gauzy/contracts';
import { AuthService } from '../auth.service';
import { EmployeeService } from '../../employee/employee.service';
import { UserOrganizationService } from '../../user-organization/user-organization.services';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	public loggingEnabled: boolean = false;

	constructor(
		private readonly _authService: AuthService,
		private readonly _employeeService: EmployeeService,
		private readonly _userOrganizationService: UserOrganizationService
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
	async validate(payload: JwtPayload, done: (err: unknown, user?: unknown) => void): Promise<void> {
		try {
			const { id, thirdPartyId, employeeId, organizationId, tenantId } = payload;

			if (this.loggingEnabled) console.log('Validate JWT payload:', payload);

			// We use this to also attach the user object to the request context.
			const user: IUser = await this._authService.getAuthenticatedUser(id, thirdPartyId);

			if (!user) {
				return done(new UnauthorizedException('unauthorized'), false);
			}

			// Validate and assign employeeId from JWT
			let validatedEmployee = null;
			if (employeeId) {
				const employee = await this._employeeService.findOneByIdString(employeeId);

				if (!employee || employee.userId !== user.id) {
					return done(new UnauthorizedException('unauthorized'), false);
				}

				validatedEmployee = employee;
				user.employeeId = employeeId;
			}

			// Validate and assign organizationId from JWT
			if (organizationId) {
				// Cross-validate: if employeeId was provided, ensure it belongs to the claimed organization
				if (validatedEmployee && validatedEmployee.organizationId !== organizationId) {
					return done(
						new UnauthorizedException('Employee does not belong to the claimed organization'),
						false
					);
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
					return done(new UnauthorizedException('User does not have access to organization'), false);
				}

				user.lastOrganizationId = organizationId;
			}

			done(null, user);
		} catch (error) {
			console.error('Error occurred during JWT validation:', error);
			return done(new UnauthorizedException('unauthorized', error.message), false);
		}
	}
}
