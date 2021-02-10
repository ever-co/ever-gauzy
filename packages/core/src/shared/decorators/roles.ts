import { environment as env } from '@gauzy/config';
import { RolesEnum } from '@gauzy/contracts';
import { SetMetadata, createParamDecorator } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../core/context';

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
