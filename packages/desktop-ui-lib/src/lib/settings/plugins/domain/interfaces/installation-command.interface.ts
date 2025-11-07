import { Observable } from 'rxjs';

/**
 * Command interface for executing installation steps
 * Following the Command Pattern
 */
export interface IInstallationCommand<T = any, R = any> {
	/**
	 * Executes the command
	 * @param params Command parameters
	 * @returns Observable with command result
	 */
	execute(params: T): Observable<R>;

	/**
	 * Optional: Undo/rollback the command
	 * @param params Command parameters
	 */
	undo?(params: T): Observable<void>;
}
