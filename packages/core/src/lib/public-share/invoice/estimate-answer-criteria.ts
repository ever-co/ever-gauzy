import { ID, IInvoiceUpdateInput } from '@gauzy/contracts';
import { FindOptionsWhere, IsNull, Not, Or } from 'typeorm';
import { Invoice } from '../../core/entities/internal';

/**
 * The row a client's answer to an estimate updates: the estimate, and only while the answer still changes it. The same
 * answer given twice (two clicks, two tabs) then changes the estimate once, even at the same moment: the database
 * checks the condition again on the row the first answer wrote, and the second one updates nothing. The update's
 * `affected` count says which answer changed it, so the team is told once.
 * - An acceptance where the organization converts accepted estimates (`isEstimate: false`, the public page sends
 *   `DRAFT` with it) turns the estimate into a draft invoice: written while the document is still an estimate, whatever
 *   its status (one already in `DRAFT` is converted too).
 * - Any other answer that names a status is written while the estimate has another one, or none.
 *
 * @param id - The estimate.
 * @param entity - The answer.
 */
export function answerCriteria(id: ID, entity: IInvoiceUpdateInput): FindOptionsWhere<Invoice> {
	if (entity?.isEstimate === false) {
		return { id, isEstimate: Or(Not(false), IsNull()) };
	}
	const status = entity?.status;
	if (!status) {
		return { id };
	}
	return { id, status: Or(Not(status), IsNull()) };
}
