import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmployeeService } from '../../../employee/employee.service';

@Injectable()
export default class OwnerGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly employeeSrv: EmployeeService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		let isAuthorized = false;
		const req = context.switchToHttp().getRequest();
		const paramsId = req.params.id;
		const roles = this._reflector.get<string[]>(
			'roles',
			context.getHandler()
		);
		const permissions = this._reflector.get<string[]>(
			'permissions',
			context.getHandler()
		);
		if (paramsId) {
			const currentService = context
				.getClass()
				.name.split('Controller')[0];
			const currentData = await this[
				`${currentService.toLowerCase()}Srv`
			].findOne(paramsId);
			isAuthorized =
				currentData.userId && currentData.userId === req.user.id;
		}
		req.ownerGuardStatus = isAuthorized;
		return permissions || roles ? true : isAuthorized;
	}
}
