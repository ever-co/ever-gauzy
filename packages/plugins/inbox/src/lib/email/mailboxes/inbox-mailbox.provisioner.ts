import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { INBOX_EMPLOYEE_CREATED } from './inbox-employee.subscriber';
import { InboxMailboxService } from './inbox-mailbox.service';

/**
 * Auto-provisioning on employee creation (plan 04 §5.1): every employee the platform creates is handed to
 * `InboxMailboxService.onEmployeeCreated`, which creates the mailbox where the organization opted in (never for agent
 * employees; best effort, never failing the employee's creation).
 */
@Injectable()
export class InboxMailboxProvisioner implements OnModuleInit, OnModuleDestroy {
	private subscription?: Subscription;

	constructor(private readonly mailboxes: InboxMailboxService) {}

	onModuleInit(): void {
		this.subscription = INBOX_EMPLOYEE_CREATED.subscribe((employee) => {
			// A moment later, off the ORM's transaction: the employee row is committed by the time the mailbox looks it up.
			setTimeout(() => void this.mailboxes.onEmployeeCreated(employee), 2_000).unref?.();
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
	}
}
