import { SetMetadata, createParamDecorator } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { verify } from 'jsonwebtoken';
import { environment as env } from '@gauzy/config';

export const Permissions = (...permissions: string[]) =>
	SetMetadata('permissions', permissions);

export const UserPermissions = createParamDecorator((): PermissionsEnum[] => {
	const token = RequestContext.currentToken();

	const { permissions } = verify(token, env.JWT_SECRET) as {
		id: string;
		permissions: PermissionsEnum[];
	};

	return permissions.map((permission) => PermissionsEnum[permission]);
});
