import { HttpErrorResponse } from '@angular/common/http';
import { AccountDeletionOutcomeEnum } from '@gauzy/contracts';
import { NgxDeleteAccountConfirmComponent } from './delete-account-confirm.component';

const TOKEN = 'a'.repeat(43);

function setup(token: string | null = TOKEN) {
	const calls: string[] = [];
	const service = {
		verify: jest.fn(async () => {
			calls.push('verify');
			return {
				email: 'j***@ever.co',
				expiresAt: new Date(),
				planHash: 'plan-1',
				accounts: [
					{
						workspace: 'Acme',
						organizations: ['Acme'],
						otherMembers: 0,
						soleAdmin: false,
						outcome: AccountDeletionOutcomeEnum.WORKSPACE_DELETED
					}
				]
			};
		}),
		confirm: jest.fn(async () => ({ deleted: true, accounts: 1, workspacesDeleted: 1 }))
	};
	const route = { snapshot: { queryParamMap: { get: (key: string) => (key === 'token' ? token : null) } } };
	const router = {
		navigate: jest.fn(async () => {
			calls.push('navigate');
			return true;
		})
	};
	const cdr = { markForCheck: jest.fn() };
	const component = new NgxDeleteAccountConfirmComponent(
		service as any,
		route as any,
		router as any,
		cdr as any,
		document
	);
	return { component, service, router, calls };
}

describe('NgxDeleteAccountConfirmComponent', () => {
	afterEach(() => document.querySelectorAll('meta[name="referrer"]').forEach((meta) => meta.remove()));

	it('drops the token from the address bar before it calls the API', async () => {
		const { component, router, calls } = setup();

		await component.ngOnInit();

		expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {}, replaceUrl: true }));
		expect(calls).toEqual(['navigate', 'verify']);
		expect(component.state).toBe('ready');
	});

	it('sets no-referrer while open and restores it when closed', () => {
		const { component } = setup();
		expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');

		component.ngOnDestroy();

		expect(document.querySelector('meta[name="referrer"]')).toBeNull();
	});

	it('shows the invalid state without a token or when verify fails', async () => {
		const missing = setup(null);
		await missing.component.ngOnInit();
		expect(missing.component.state).toBe('invalid');
		expect(missing.service.verify).not.toHaveBeenCalled();

		const refused = setup();
		refused.service.verify.mockRejectedValueOnce(new HttpErrorResponse({ status: 410 }));
		await refused.component.ngOnInit();
		expect(refused.component.state).toBe('invalid');
	});

	it('offers a retry, not the invalid state, when verify fails for another reason than 410', async () => {
		for (const status of [0, 429, 500, 503]) {
			const { component, service } = setup();
			service.verify.mockRejectedValueOnce(new HttpErrorResponse({ status }));

			await component.ngOnInit();
			expect(component.state).toBe('unavailable');

			await component.retryVerify();

			expect(service.verify).toHaveBeenCalledTimes(2);
			expect(service.verify).toHaveBeenLastCalledWith(TOKEN);
			expect(component.state).toBe('ready');
		}
	});

	it('deletes only after the box is ticked and the word is typed', async () => {
		const { component, service } = setup();
		await component.ngOnInit();

		await component.confirm();
		expect(service.confirm).not.toHaveBeenCalled();

		component.understood = true;
		component.typed = 'delete';
		expect(component.canConfirm).toBe(false);

		component.typed = 'DELETE';
		await component.confirm();

		expect(service.confirm).toHaveBeenCalledWith(TOKEN, 'plan-1');
		expect(component.state).toBe('done');
		expect(component.result).toEqual({ deleted: true, accounts: 1, workspacesDeleted: 1 });
	});

	it('treats a 410 on confirm as a used or expired link', async () => {
		const { component, service } = setup();
		await component.ngOnInit();
		component.understood = true;
		component.typed = 'DELETE';
		service.confirm.mockRejectedValueOnce(new HttpErrorResponse({ status: 410 }));

		await component.confirm();

		expect(component.state).toBe('invalid');
	});

	it('returns to the form after a failed deletion and retries with the same token', async () => {
		const { component, service } = setup();
		await component.ngOnInit();
		component.understood = true;
		component.typed = 'DELETE';
		service.confirm.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));

		await component.confirm();
		expect(component.state).toBe('failed');

		component.retryConfirm();
		expect(component.state).toBe('ready');

		await component.confirm();

		expect(service.confirm).toHaveBeenCalledTimes(2);
		expect(service.confirm).toHaveBeenLastCalledWith(TOKEN, 'plan-1');
		expect(component.state).toBe('done');
	});

	it('shows the new preview and asks again when what will be deleted changed (409)', async () => {
		const { component, service } = setup();
		await component.ngOnInit();
		component.understood = true;
		component.typed = 'DELETE';
		service.confirm.mockRejectedValueOnce(new HttpErrorResponse({ status: 409 }));
		service.verify.mockResolvedValueOnce({
			email: 'j***@ever.co',
			expiresAt: new Date(),
			planHash: 'plan-2',
			accounts: [
				{
					workspace: 'Acme',
					organizations: ['Acme'],
					otherMembers: 1,
					soleAdmin: true,
					outcome: AccountDeletionOutcomeEnum.ACCOUNT_REMOVED
				}
			]
		});

		await component.confirm();

		expect(service.verify).toHaveBeenCalledTimes(2);
		expect(component.state).toBe('ready');
		expect(component.planChanged).toBe('nothing-deleted');
		expect(component.preview?.accounts[0].outcome).toBe(AccountDeletionOutcomeEnum.ACCOUNT_REMOVED);
		expect(component.understood).toBe(false);
		expect(component.typed).toBe('');
		expect(component.canConfirm).toBe(false);

		component.understood = true;
		component.typed = 'DELETE';
		await component.confirm();

		expect(service.confirm).toHaveBeenLastCalledWith(TOKEN, 'plan-2');
		expect(component.state).toBe('done');
	});

	it('says some accounts were deleted when the 409 reports a partial deletion', async () => {
		const { component, service } = setup();
		await component.ngOnInit();
		component.understood = true;
		component.typed = 'DELETE';
		service.confirm.mockRejectedValueOnce(
			new HttpErrorResponse({
				status: 409,
				error: {
					statusCode: 409,
					message:
						'Some of your accounts were deleted, but what would be deleted for the others changed while we worked. Review what remains and confirm again.'
				}
			})
		);

		await component.confirm();

		expect(service.verify).toHaveBeenCalledTimes(2);
		expect(component.state).toBe('ready');
		expect(component.planChanged).toBe('partly-deleted');
		expect(component.understood).toBe(false);
		expect(component.typed).toBe('');
	});
});
