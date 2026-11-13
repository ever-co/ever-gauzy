// Must stay first: the entities barrel resolves the circular entity imports.
import '../../../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { EstimateStatusTypesEnum, IInvoice } from '@gauzy/contracts';
import { EstimateAnsweredEvent } from '../../../../invoice/estimate-answer/estimate-answered.event';
import { PublicInvoiceUpdateCommand } from '../public-invoice-update.command';
import { PublicInvoiceUpdateHandler } from './public-invoice-update.handler';

const TENANT = 'tenant-1';
const params = { id: 'estimate-1', token: 'estimate-token' } as IInvoice;

/**
 * A client accepts or declines an estimate from the estimate email (PUT /public/invoice/:id/:token). The answer used to
 * change the status and tell nobody: the team now hears of an answer that changed the estimate, once.
 */
describe('PublicInvoiceUpdateHandler', () => {
	/**
	 * @param before - The estimate as the handler reads it before the update.
	 * @param options.affected - The rows each update changes, in turn: the service writes only a change of status.
	 */
	function setup(
		before: Partial<IInvoice> | null,
		{ refuse = false, emailRead = 'ok', affected = [1] as (number | undefined)[] } = {}
	) {
		const updated = { affected: affected[0] };
		let updates = 0;
		const service = {
			updateInvoice: jest.fn(async () => {
				if (refuse) {
					throw new ForbiddenException('Invalid estimate token');
				}
				const result = updates === 0 ? updated : { affected: affected[updates] };
				updates += 1;
				return result;
			})
		};
		const invoices = { findOne: jest.fn(async () => before) };
		const estimateEmails = {
			findOne: jest.fn(async () => {
				if (emailRead === 'fails') {
					throw new Error('connection reset');
				}
				return { id: 'estimate-email-1', email: 'billing@acme.test' };
			})
		};
		const eventBus = { publish: jest.fn() };
		const handler = new PublicInvoiceUpdateHandler(
			service as never,
			invoices as never,
			estimateEmails as never,
			eventBus as never
		);
		return { handler, service, invoices, estimateEmails, eventBus, updated };
	}

	const sentEstimate = { id: 'estimate-1', status: EstimateStatusTypesEnum.SENT, isEstimate: true, tenantId: TENANT };
	const answer = (status: EstimateStatusTypesEnum) => new PublicInvoiceUpdateCommand(params, { status });

	it('saves an acceptance and tells the team, with the address the estimate was sent to', async () => {
		const { handler, service, eventBus, estimateEmails, updated } = setup(sentEstimate);

		const result = await handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED));

		expect(result).toBe(updated);
		expect(service.updateInvoice).toHaveBeenCalledWith(params, { status: EstimateStatusTypesEnum.ACCEPTED });
		expect(estimateEmails.findOne).toHaveBeenCalledWith({
			where: { token: 'estimate-token', tenantId: TENANT },
			select: { id: true, email: true }
		});
		expect(eventBus.publish).toHaveBeenCalledWith(
			new EstimateAnsweredEvent({
				invoiceId: 'estimate-1',
				tenantId: TENANT,
				isAccepted: true,
				answeredFrom: 'billing@acme.test'
			})
		);
	});

	it('tells the team of a decline too', async () => {
		const { handler, eventBus } = setup(sentEstimate);

		await handler.execute(answer(EstimateStatusTypesEnum.REJECTED));

		expect(eventBus.publish).toHaveBeenCalledWith(
			expect.objectContaining({ answer: expect.objectContaining({ isAccepted: false }) })
		);
	});

	it('tells nobody of the same answer given again, which changes no row', async () => {
		const accepted = { ...sentEstimate, status: EstimateStatusTypesEnum.ACCEPTED };
		const { handler, service, eventBus } = setup(accepted, { affected: [0] });

		await handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED));

		expect(service.updateInvoice).toHaveBeenCalledTimes(1);
		expect(eventBus.publish).not.toHaveBeenCalled();
	});

	it('tells the team once of two answers sent at the same moment, both read before either was saved', async () => {
		// Both read SENT; the database lets the first update change the row, and the second changes none
		const { handler, eventBus } = setup(sentEstimate, { affected: [1, 0] });

		await Promise.all([
			handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED)),
			handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED))
		]);

		expect(eventBus.publish).toHaveBeenCalledTimes(1);
	});

	it('decides on the status read before when the database does not report the rows it changed', async () => {
		const changed = setup(sentEstimate, { affected: [undefined] });
		await changed.handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED));
		expect(changed.eventBus.publish).toHaveBeenCalledTimes(1);

		const same = setup({ ...sentEstimate, status: EstimateStatusTypesEnum.ACCEPTED }, { affected: [undefined] });
		await same.handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED));
		expect(same.eventBus.publish).not.toHaveBeenCalled();
	});

	it('tells nobody of a status that is no answer, or of a document that is no estimate', async () => {
		const notAnswer = setup(sentEstimate);
		await notAnswer.handler.execute(answer(EstimateStatusTypesEnum.VIEWED));
		expect(notAnswer.eventBus.publish).not.toHaveBeenCalled();

		const invoice = setup({ ...sentEstimate, isEstimate: false });
		await invoice.handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED));
		expect(invoice.eventBus.publish).not.toHaveBeenCalled();
	});

	it('tells nobody of a refused answer, which it refuses as before', async () => {
		const { handler, eventBus, estimateEmails } = setup(sentEstimate, { refuse: true });

		await expect(handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED))).rejects.toBeInstanceOf(
			ForbiddenException
		);

		expect(estimateEmails.findOne).not.toHaveBeenCalled();
		expect(eventBus.publish).not.toHaveBeenCalled();
	});

	it('still lets the update decide when the estimate cannot be read first, and tells nobody', async () => {
		const { handler, invoices, service, eventBus } = setup(null);
		invoices.findOne.mockRejectedValueOnce(new Error('invalid input syntax for type uuid'));

		await handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED));

		expect(service.updateInvoice).toHaveBeenCalledTimes(1);
		expect(eventBus.publish).not.toHaveBeenCalled();
	});

	it('keeps the saved answer when the team cannot be told', async () => {
		const { handler, eventBus, updated } = setup(sentEstimate, { emailRead: 'fails' });

		await expect(handler.execute(answer(EstimateStatusTypesEnum.ACCEPTED))).resolves.toBe(updated);

		expect(eventBus.publish).not.toHaveBeenCalled();
	});
});
