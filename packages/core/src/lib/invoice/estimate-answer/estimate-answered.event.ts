import { IEvent } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

/** A client's answer to an estimate, given from the Accept or Decline link of the estimate email. */
export interface IEstimateAnswer {
	/** The estimate. */
	invoiceId: ID;
	/** Its tenant: the answer comes over a public link, with no request context to read it from. */
	tenantId: ID;
	/** Whether the client accepted it; false when they declined it. */
	isAccepted: boolean;
	/** The address the estimate link was sent to, which answered, when it is known. */
	answeredFrom?: string | null;
}

/**
 * Published once a client's answer changed an estimate's status to accepted or declined, so that whoever handles
 * invoices hears of it (`EstimateAnswerNotifier`).
 */
export class EstimateAnsweredEvent implements IEvent {
	constructor(public readonly answer: IEstimateAnswer) {}
}
