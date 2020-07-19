import { SetMetadata, createParamDecorator } from '@nestjs/common';
import { RequestContext } from '../../core/context';
import { environment as env } from '@env-api/environment';
import { verify } from 'jsonwebtoken';
import { RolesEnum } from '@gauzy/models';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

export const UserRole = createParamDecorator(
	(): RolesEnum => {
		const token = RequestContext.currentToken();

		const { role } = verify(token, env.JWT_SECRET) as {
			id: string;
			role: string;
		};

		return RolesEnum[role];
	}
);
