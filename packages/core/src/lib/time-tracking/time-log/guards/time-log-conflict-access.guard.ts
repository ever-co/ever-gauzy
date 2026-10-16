import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { isUUID } from 'class-validator';
import { TimeLogService } from '../time-log.service';

/**
 * Lets a conflict read through only for an employee whose time logs the caller may read: their own, an
 * employee they manage, or anyone for a CHANGE_SELECTED_EMPLOYEE holder. The rule is
 * `TimeLogService.assertCanReadEmployeeTimeLogs`.
 *
 * `GET /timesheet/time-log/conflict` and the `timeLogConflicts` GraphQL field both carry it. The field
 * dispatches the conflict command directly, so this is its only employee check, while the route's service
 * method checks the validated query again.
 */
@Injectable()
export class TimeLogConflictAccessGuard implements CanActivate {
	constructor(private readonly _timeLogService: TimeLogService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (context.getType<GqlContextType>() === 'graphql') {
			// Nothing validates GraphQL arguments, so every value is checked.
			const employeeId = GqlExecutionContext.create(context).getArgs()?.employeeId;
			await this._timeLogService.assertCanReadEmployeeTimeLogs(employeeId);
		} else {
			// Guards run before the route's validation pipe, so a value its DTO rejects is left to that 400.
			const employeeId = context.switchToHttp().getRequest()?.query?.employeeId;
			if (typeof employeeId === 'string' && isUUID(employeeId)) {
				await this._timeLogService.assertCanReadEmployeeTimeLogs(employeeId);
			}
		}
		return true;
	}
}
