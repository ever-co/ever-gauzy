import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, mergeMap } from 'rxjs';
import { EmployeeService } from './employee.service';
import { IWorkingEmployeeLookup, leaveOutFormerEmployees } from './former-employees';

/**
 * Leaves the employees whose work ended out of the member lists (`members`) a route or a GraphQL field answers:
 * a team's, a sprint's, a project module's, a department's, a client's. Their memberships stay, so that Back to
 * Work restores them; see {@link leaveOutFormerEmployees}.
 *
 * Usage: `@UseInterceptors(FormerEmployeesInterceptor)` on the controller or resolver. `EmployeeService` is read
 * from the application rather than injected, so the interceptor serves a module that does not import
 * `EmployeeModule` too, and the employee module is not loaded from the modules that use it.
 */
@Injectable()
export class FormerEmployeesInterceptor implements NestInterceptor {
	private lookup: IWorkingEmployeeLookup | undefined;

	constructor(private readonly moduleRef: ModuleRef) {}

	intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(
			mergeMap(async (response: unknown) => {
				await leaveOutFormerEmployees(response, this.workingEmployeeLookup());
				return response;
			})
		);
	}

	/** The application's `EmployeeService`; without it, only the employee rows that state their status are read. */
	private workingEmployeeLookup(): IWorkingEmployeeLookup | undefined {
		if (!this.lookup) {
			try {
				this.lookup = this.moduleRef.get(EmployeeService, { strict: false });
			} catch {
				this.lookup = undefined;
			}
		}
		return this.lookup;
	}
}
