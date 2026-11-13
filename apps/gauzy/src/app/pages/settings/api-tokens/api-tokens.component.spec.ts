import { TestBed } from '@angular/core/testing';
import { NbDialogRef, NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { IUserApiToken, UserApiTokenExpiryEnum } from '@gauzy/contracts';
import { UserApiTokenService } from '@gauzy/ui-core/core';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { ApiTokenFormDialogComponent } from './api-token-form-dialog/api-token-form-dialog.component';
import { ApiTokenSecretDialogComponent } from './api-token-secret-dialog/api-token-secret-dialog.component';
import { ApiTokensComponent } from './api-tokens.component';

/**
 * The page lists the user's own tokens, creates one and shows its plain value once, in a dialog that cannot be dismissed
 * by accident, and revokes one only after a confirmation.
 */
describe('ApiTokensComponent', () => {
	const token: IUserApiToken = {
		id: 'token-1',
		name: 'Agent',
		prefix: 'gzp_abcd1234',
		userId: 'user-1',
		tenantId: 'tenant-1',
		expiresAt: null,
		lastUsedAt: null,
		revokedAt: null
	};
	const created = { ...token, token: `gzp_${'a'.repeat(43)}` };
	const input = { name: 'Agent', expiry: UserApiTokenExpiryEnum.YEAR_1 };

	let service: { list: jest.Mock; create: jest.Mock; revoke: jest.Mock };
	let dialog: { open: jest.Mock };
	let toastr: { success: jest.Mock; danger: jest.Mock };
	let dialogResults: Map<unknown, unknown>;
	let component: ApiTokensComponent;

	beforeEach(() => {
		service = {
			list: jest.fn(() => of({ items: [token], total: 1 })),
			create: jest.fn(() => of(created)),
			revoke: jest.fn(() => of(undefined))
		};
		dialogResults = new Map<unknown, unknown>([
			[ApiTokenFormDialogComponent, input],
			[AlertModalComponent, 'yes']
		]);
		dialog = { open: jest.fn((type: unknown) => ({ onClose: of(dialogResults.get(type)) })) };
		toastr = { success: jest.fn(), danger: jest.fn() };

		TestBed.configureTestingModule({
			providers: [
				{ provide: UserApiTokenService, useValue: service },
				{ provide: NbDialogService, useValue: dialog },
				{ provide: NbToastrService, useValue: toastr },
				{ provide: TranslateService, useValue: { instant: (key: string) => key } }
			]
		});
		component = TestBed.runInInjectionContext(() => new ApiTokensComponent());
	});

	afterEach(() => {
		component.ngOnDestroy();
	});

	it('lists the tokens when it opens', () => {
		component.ngOnInit();

		expect(component.tokens()).toEqual([token]);
		expect(component.loading()).toBe(false);
	});

	it('says so when the list cannot be read', () => {
		service.list.mockReturnValue(throwError(() => new Error('down')));

		component.ngOnInit();

		expect(toastr.danger).toHaveBeenCalledWith('USER_API_TOKENS.ERRORS.LOAD_FAILED', expect.anything());
		expect(component.loading()).toBe(false);
	});

	describe('creating', () => {
		it('sends what the form closed with, then shows the plain value once, in a dialog that stays open', () => {
			component.openCreateDialog();

			expect(service.create).toHaveBeenCalledWith(input);
			const opens = dialog.open.mock.calls.filter(([type]) => type === ApiTokenSecretDialogComponent);
			expect(opens).toHaveLength(1);
			expect(opens[0][1]).toEqual({ context: { created }, closeOnBackdropClick: false, closeOnEsc: false });
			expect(service.list).toHaveBeenCalled();
		});

		it('never keeps the plain value on the page', () => {
			component.openCreateDialog();

			expect(JSON.stringify(component.tokens())).not.toContain(created.token);
		});

		it('sends nothing when the form is cancelled', () => {
			dialogResults.set(ApiTokenFormDialogComponent, undefined);

			component.openCreateDialog();

			expect(service.create).not.toHaveBeenCalled();
		});

		it('names the limit when the API answers 400', () => {
			service.create.mockReturnValue(throwError(() => ({ status: 400 })));

			component.openCreateDialog();

			expect(toastr.danger).toHaveBeenCalledWith('USER_API_TOKENS.ERRORS.TOO_MANY', expect.anything());
		});

		it('says it failed otherwise, and shows no secret dialog', () => {
			service.create.mockReturnValue(throwError(() => ({ status: 500 })));

			component.openCreateDialog();

			expect(toastr.danger).toHaveBeenCalledWith('USER_API_TOKENS.ERRORS.CREATE_FAILED', expect.anything());
			expect(dialog.open.mock.calls.some(([type]) => type === ApiTokenSecretDialogComponent)).toBe(false);
		});
	});

	describe('revoking', () => {
		it('revokes after the confirmation and reads the list again', () => {
			component.revoke(token);

			expect(dialog.open.mock.calls[0][0]).toBe(AlertModalComponent);
			expect(service.revoke).toHaveBeenCalledWith('token-1');
			expect(service.list).toHaveBeenCalled();
		});

		it('does nothing when the confirmation is declined', () => {
			dialogResults.set(AlertModalComponent, 'no');
			component.revoke(token);
			expect(service.revoke).not.toHaveBeenCalled();

			dialogResults.set(AlertModalComponent, undefined);
			component.revoke(token);
			expect(service.revoke).not.toHaveBeenCalled();
		});

		it('says it failed', () => {
			service.revoke.mockReturnValue(throwError(() => new Error('down')));

			component.revoke(token);

			expect(toastr.danger).toHaveBeenCalledWith('USER_API_TOKENS.ERRORS.REVOKE_FAILED', expect.anything());
		});
	});

	it('tells an expired token apart', () => {
		expect(component.hasExpired(token)).toBe(false);
		expect(component.hasExpired({ ...token, expiresAt: new Date(Date.now() + 60_000) })).toBe(false);
		expect(component.hasExpired({ ...token, expiresAt: new Date(Date.now() - 60_000) })).toBe(true);
	});
});

describe('ApiTokenFormDialogComponent', () => {
	let dialogRef: { close: jest.Mock };
	let component: ApiTokenFormDialogComponent;

	beforeEach(() => {
		dialogRef = { close: jest.fn() };
		TestBed.configureTestingModule({ providers: [{ provide: NbDialogRef, useValue: dialogRef }] });
		component = TestBed.runInInjectionContext(() => new ApiTokenFormDialogComponent());
	});

	it('offers 90 days, a year and never, starting at 90 days', () => {
		expect(component.expiries.map((expiry) => expiry.value)).toEqual([
			UserApiTokenExpiryEnum.DAYS_90,
			UserApiTokenExpiryEnum.YEAR_1,
			UserApiTokenExpiryEnum.NEVER
		]);
		expect(component.form.getRawValue().expiry).toBe(UserApiTokenExpiryEnum.DAYS_90);
	});

	it.each([
		['an empty name', ''],
		['a blank name', '   '],
		['a name that is too long', 'x'.repeat(101)]
	])('does not close with %s', (_why, name) => {
		component.form.controls.name.setValue(name);

		component.save();

		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('closes with the trimmed name and the expiry', () => {
		component.form.controls.name.setValue('  Agent  ');
		component.form.controls.expiry.setValue(UserApiTokenExpiryEnum.NEVER);

		component.save();

		expect(dialogRef.close).toHaveBeenCalledWith({ name: 'Agent', expiry: UserApiTokenExpiryEnum.NEVER });
	});

	it('closes with nothing when cancelled', () => {
		component.cancel();

		expect(dialogRef.close).toHaveBeenCalledWith();
	});
});
