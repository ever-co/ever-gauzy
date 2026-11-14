import { randomUUID } from 'node:crypto';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';

/** The tenant and organization a client's answer is told in: the estimate's own. */
export interface IEstimateAnswerScope {
	tenantId: ID;
	organizationId: ID;
}

/**
 * The user the team is told as: nobody, in the estimate's tenant and organization, with no employee (each receiver is
 * named on its notification, never taken from the context) and no permission.
 */
export function estimateAnswerUserOf(scope: IEstimateAnswerScope) {
	return {
		id: undefined,
		tenantId: scope.tenantId,
		lastOrganizationId: scope.organizationId,
		name: 'Estimate answer',
		firstName: 'Estimate answer',
		lastName: '',
		employeeId: undefined,
		permissions: [] as never[]
	};
}

/** Thrown before anything is filed when this process opens no request context of the estimate's tenant. */
export class EstimateAnswerContextUnavailableError extends Error {
	constructor() {
		super("The answer to an estimate cannot open a request context of the estimate's tenant in this process.");
		this.name = 'EstimateAnswerContextUnavailableError';
	}
}

/**
 * Runs `fn` inside a request context of its own, in the estimate's tenant and organization, on a fresh store that holds
 * nothing of the public request the answer came on (the way the timer reminders are filed). Nobody is signed in on that
 * request, and the tenant-aware writes (`TenantAwareCrudService.create`: the notifications, and the notification
 * settings a receiver without any gets) stamp the tenant they file under from the request context, over the one the
 * notice carries: without this context, they were filed with no tenant, where no receiver can read them. Refuses to run
 * `fn` when the context is not the tenant's.
 */
export async function runInEstimateAnswerContext<T>(scope: IEstimateAnswerScope, fn: () => Promise<T>): Promise<T> {
	const request = { user: estimateAnswerUserOf(scope), headers: {}, query: {}, params: {}, body: {} };
	return RequestContext.runWithRequest(
		request as never,
		async () => {
			if (RequestContext.currentTenantId() !== scope.tenantId) {
				throw new EstimateAnswerContextUnavailableError();
			}
			return fn();
		},
		{ id: randomUUID() as ID }
	);
}
