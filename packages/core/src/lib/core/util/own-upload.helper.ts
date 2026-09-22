import { NotFoundException } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';

/** A record that records who uploaded it, rather than which employee it belongs to. */
export interface IUploadedRecord {
	uploadedById?: ID;
}

/**
 * Refuses a record the caller did not upload, unless they may act for other employees.
 *
 * The media plugins (videos, camshots, soundshots) store `uploadedById` rather than `employeeId`, and
 * the automatic per-employee restriction in `TenantAwareCrudService` is gated on the entity having an
 * `employeeId` column — so it never applies to them and a by-id read was scoped to the tenant alone.
 *
 * The answer is 404 rather than 403 on purpose: a 403 would confirm that the id names a real record
 * belonging to someone else.
 *
 * @param record - The record that was read.
 * @param notFoundMessage - The message to answer with, identical to the one used when nothing was found.
 * @returns The record, when the caller may see it.
 * @throws NotFoundException when the caller uploaded neither the record nor holds CHANGE_SELECTED_EMPLOYEE.
 */
export function assertCallerOwnsUpload<T extends IUploadedRecord>(record: T, notFoundMessage: string): T {
	if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
		return record;
	}

	const currentEmployeeId = RequestContext.currentEmployeeId();
	if (!currentEmployeeId || record.uploadedById !== currentEmployeeId) {
		throw new NotFoundException(notFoundMessage);
	}
	return record;
}
