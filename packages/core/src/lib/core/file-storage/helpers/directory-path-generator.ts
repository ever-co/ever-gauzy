// Concrete implementation of the path generator
import * as moment from 'moment';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { RequestContext } from '../../context';
import { IDirectoryPathGenerator } from './directory-path-generator.interface';

export class DirectoryPathGenerator implements IDirectoryPathGenerator {
	/**
	 * Generates the base directory path with the given name.
	 * Includes a timestamped subdirectory in the format `YYYY/MM/DD`.
	 *
	 * @param name - The name to be used as the base directory.
	 * @returns The full base directory path including the timestamped subdirectory.
	 */
	public getBaseDirectory(name: string): string {
		return path.join(name, moment().format('YYYY/MM/DD'));
	}

	/**
	 * Generates a subdirectory path specific to the current user context.
	 * Uses the `tenantId` and `employeeId` from the current user, or generates UUIDs if not available.
	 *
	 * @returns The subdirectory path in the format `<tenantId>/<employeeId>`.
	 */
	public getSubDirectory(): string {
		// Retrieve the current user from the request context
		const user = RequestContext.currentUser();

		// Extract or generate identifiers for the tenant and employee
		const tenantId = user?.tenantId || uuid(); // Use the tenantId if available, otherwise generate a UUID
		const employeeId = user?.employeeId || uuid(); // Use the employeeId if available, otherwise generate a UUID

		// Construct and return the subdirectory path
		return path.join(tenantId, employeeId);
	}
}
