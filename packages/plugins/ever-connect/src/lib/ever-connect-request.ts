import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';
import { roleNameOf } from './guards/ever-connect-operator.guard';
import { EverConnectStore } from './ever-connect.store';

/** The signed-in user as Gauzy's authentication guard attaches it to the request. */
export interface RequestUser {
	id?: string;
	tenantId?: string;
	role?: string | { name?: string };
}

export interface RequestWithUser {
	user?: RequestUser;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The organization a request acts for, after checking the caller is a member of it. */
export interface OrganizationScope {
	tenantId: string;
	organizationId: string;
	userId: string;
	isOperator: boolean;
}

/**
 * The organization of an organization route (`?organizationId=`): it must be an organization of the
 * caller's tenant that the caller is an active member of (403 otherwise). Also answers whether the
 * caller is the operator of the installation.
 */
export async function organizationScope(
	request: RequestWithUser,
	organizationId: string | undefined,
	store: EverConnectStore,
	operator: EverOperatorService
): Promise<OrganizationScope> {
	const user = request?.user;
	if (!user?.id || !user.tenantId) {
		throw new ForbiddenException();
	}
	if (!organizationId || !UUID.test(organizationId)) {
		throw new BadRequestException('organizationId must be the id of an organization.');
	}
	if (!(await store.isMember(user.tenantId, organizationId, user.id))) {
		throw new ForbiddenException('Access to this organization is required.');
	}
	return {
		tenantId: user.tenantId,
		organizationId,
		userId: user.id,
		isOperator: await operator.isOperator(user, roleNameOf(user))
	};
}
