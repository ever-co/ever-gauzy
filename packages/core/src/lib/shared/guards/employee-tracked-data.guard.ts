import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../context';
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
		const organizationId = request.query.organizationId || request.body.organizationId || request.params.organizationId;

		if (organizationId) {
			const result = await this.dataSource.query(`SELECT "allowEmployeeToSeeTrackedData" FROM "organization" WHERE "id" = $1`, [organizationId]);
			if (result && result.length > 0 && result[0].allowEmployeeToSeeTrackedData === false) {
				throw new ForbiddenException('Employees are not allowed to view tracked data in this organization');
			}
		}

		return true;
	}
}
