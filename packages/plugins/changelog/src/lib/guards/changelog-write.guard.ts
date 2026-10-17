import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext, TenantService } from '@gauzy/core';

/**
 * The changelog is shared by every tenant, but a super admin administers one tenant only and anyone
 * can register a tenant. So once the installation has several tenants, only a super admin of its
 * first tenant (the oldest one, deleted included, which no tenant registered later can become) or a
 * super admin listed in `EVER_OPERATOR_USER_IDS` may change it. Everyone else gets 403.
 */
@Injectable()
export class ChangelogWriteGuard implements CanActivate {
	constructor(private readonly tenantService: TenantService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const user = context.switchToHttp().getRequest()?.user;
		if (!user?.id || RequestContext.currentRoleName() !== RolesEnum.SUPER_ADMIN) {
			throw new ForbiddenException();
		}
		if (this.isListedOperator(String(user.id)) || (await this.tenantService.count()) <= 1) {
			return true;
		}
		const [first] = await this.tenantService.find({
			select: { id: true },
			order: { createdAt: 'ASC', id: 'ASC' },
			take: 1,
			withDeleted: true
		});
		if (first?.id && first.id === user.tenantId) {
			return true;
		}
		throw new ForbiddenException();
	}

	private isListedOperator(userId: string): boolean {
		const id = userId.toLowerCase();
		return (process.env['EVER_OPERATOR_USER_IDS'] ?? '')
			.split(',')
			.some((value) => value.trim().toLowerCase() === id);
	}
}
