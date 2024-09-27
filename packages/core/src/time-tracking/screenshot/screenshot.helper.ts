import * as path from 'path';
import * as moment from 'moment';
import { v4 as uuid } from 'uuid';
import { RequestContext } from '../../core/context';
import { FileStorage } from '../../core/file-storage';

/**
 * Creates file storage configuration for handling screenshot uploads.
 *
 * @returns Configured FileStorage instance
 */
export function createFileStorage() {
	// Define the base directory for storing screenshots
	const baseDirectory = getBaseDirectory();
	// Generate unique sub directories based on the current tenant and employee IDs
	const subDirectory = getSubDirectory();

	return new FileStorage().storage({
		dest: () => path.join(baseDirectory, subDirectory),
		prefix: 'screenshots'
	});
}

/**
 * Gets the base directory for storing screenshots based on the current date.
 * @returns The base directory path
 */
function getBaseDirectory(): string {
	return path.join('screenshots', moment().format('YYYY/MM/DD'));
}

/**
 * Generates a unique sub-directory based on the current tenant and employee IDs.
 * @returns The sub-directory path
 */
function getSubDirectory(): string {
	// Retrieve the tenant ID from the current context or a random UUID
	const tenantId = RequestContext.currentTenantId() || uuid();
	const employeeId = RequestContext.currentEmployeeId() || uuid();
	return path.join(tenantId, employeeId);
}
