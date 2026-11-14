import { IEvent } from '@nestjs/cqrs';
import { ITaskLinkClosedEvent } from '@gauzy/contracts';

/**
 * A pull request or issue linked to a task closed, as an integration saw it (the GitHub integration on
 * `pull_request.closed` and `issues.closed`). The integration names the task, its tenant and organization, and the
 * link's identity (`provider`, `kind`, `externalId`); it never decides what follows.
 *
 * Published in process on the CQRS event bus. The task automations, when they are on, turn it into
 * `task_link.closed` on the event outbox once per task and link (the `LINK_CLOSED` trigger); without them nothing
 * handles it.
 */
export class TaskLinkClosedEvent implements IEvent {
	constructor(public readonly input: ITaskLinkClosedEvent) {}
}
