import { Subject } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber, Employee } from '@gauzy/core';

/** An employee the platform created (its id, tenant, organization and kind). */
export interface InboxCreatedEmployee {
	id?: string;
	tenantId?: string | null;
	organizationId?: string | null;
	kind?: string | null;
}

/**
 * Employees created (TypeORM and MikroORM). The ORMs make the subscriber themselves, outside Nest, so it only signals
 * here; `InboxMailboxProvisioner` provisions the mailbox when the organization opted in.
 */
export const INBOX_EMPLOYEE_CREATED = new Subject<InboxCreatedEmployee>();

@EventSubscriber()
export class InboxEmployeeCreatedSubscriber extends BaseEntityEventSubscriber<Employee> {
	override listenTo() {
		return Employee;
	}

	override async afterEntityCreate(entity: Employee): Promise<void> {
		INBOX_EMPLOYEE_CREATED.next({
			id: entity?.id,
			tenantId: entity?.tenantId ?? null,
			organizationId: entity?.organizationId ?? null,
			kind: (entity as { kind?: string | null })?.kind ?? null
		});
	}
}
