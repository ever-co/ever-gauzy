import { ID, IInvoiceUpdateInput } from '@gauzy/contracts';
import { FindOptionsWhere, IsNull, Not, Or } from 'typeorm';
import { Invoice } from '../../core/entities/internal';

/**
 * The row a client's answer to an estimate updates: the estimate, and, when the answer names a status, only while the
 * estimate has another one or none. The same answer given twice (two clicks, two tabs) then changes the estimate once,
 * even at the same moment: the database checks the condition again on the row the first answer wrote, and the second
 * one updates nothing. The update's `affected` count says which answer changed it, so the team is told once.
 *
 * @param id - The estimate.
 * @param entity - The answer.
 */
export function answerCriteria(id: ID, entity: IInvoiceUpdateInput): FindOptionsWhere<Invoice> {
	const status = entity?.status;
	if (!status) {
		return { id };
	}
	return { id, status: Or(Not(status), IsNull()) };
}
