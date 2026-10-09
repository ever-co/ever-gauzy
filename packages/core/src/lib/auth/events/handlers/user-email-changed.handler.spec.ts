// The handler only needs the confirmation service's shape; loading it for real drags in the e-mail
// and user services and the whole entity graph.
jest.mock('../../email-confirmation.service', () => ({ EmailConfirmationService: class EmailConfirmationService {} }));

import { UserEmailChangedEvent } from '../../../user/events/user-email-changed.event';
import { UserEmailChangedHandler } from './user-email-changed.handler';

describe('UserEmailChangedHandler', () => {
	const user = { id: 'user-1', email: 'new@example.com' } as any;

	it('sends the confirmation e-mail for the new address with the deployment’s own links', async () => {
		const sendEmailVerification = jest.fn(async () => true);
		const handler = new UserEmailChangedHandler({ sendEmailVerification } as any);

		await handler.handle(new UserEmailChangedEvent(user));

		expect(sendEmailVerification).toHaveBeenCalledWith(user, {});
	});

	it('swallows a failure — the address is already saved as unconfirmed', async () => {
		const sendEmailVerification = jest.fn(async () => {
			throw new Error('smtp down');
		});
		const handler = new UserEmailChangedHandler({ sendEmailVerification } as any);

		await expect(handler.handle(new UserEmailChangedEvent(user))).resolves.toBeUndefined();
	});
});
