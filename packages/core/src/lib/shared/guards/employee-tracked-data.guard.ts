import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../core/context';
import { PermissionsEnum } from '@gauzy/contracts';

/**
 * Guard to enforce the `allowEmployeeToSeeTrackedData` organization setting.
 * Blocks employees from seeing their own tracked data if the setting is disabled,
 * while preserving the exception for managers with `CHANGE_SELECTED_EMPLOYEE` permission.
 */
@Injectable()
export class EmployeeTrackedDataGuard implements CanActivate {
	constructor(private readonly dataSource: DataSource) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const organizationId =
			request.query?.organizationId ||
			request.body?.organizationId ||
			request.params?.organizationId ||
			RequestContext.currentOrganizationId();

		if (organizationId) {
			const organizationRepo = this.dataSource.getRepository('Organization');
			const organization = await organizationRepo.findOne({
				where: { id: organizationId },
				select: { id: true, allowEmployeeToSeeTrackedData: true }
			});

			if (organization && organization['allowEmployeeToSeeTrackedData'] === false) {
				throw new ForbiddenException('Employees are not allowed to view tracked data in this organization');
			}
		}

		return true;
	}
}
