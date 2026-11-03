import { TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { of } from 'rxjs';
import { IUserApiToken, UserApiTokenExpiryEnum } from '@gauzy/contracts';
import { UserApiTokenService } from '@gauzy/ui-core/core';
import { ApiTokenFormDialogComponent } from './api-token-form-dialog/api-token-form-dialog.component';
import { ApiTokenSecretDialogComponent } from './api-token-secret-dialog/api-token-secret-dialog.component';
import { ApiTokensComponent } from './api-tokens.component';
import { ApiTokensModule } from './api-tokens.module';

/**
 * The page, its dialogs and the real module they are declared in, rendered with Nebular: what the unit tests beside this
 * one cannot see, that every element and pipe in the templates resolves at run time and that the plain token reaches the
 * screen in one place only.
 */
describe('ApiTokensModule rendered', () => {
	const live: IUserApiToken = {
		id: 'token-1',
		name: 'Task agent',
		prefix: 'gzp_abcd1234',
		userId: 'user-1',
		tenantId: 'tenant-1',
		createdAt: new Date('2026-11-03T10:00:00.000Z'),
		expiresAt: new Date(Date.now() + 90 * 864e5),
		lastUsedAt: null,
		revokedAt: null
	};
	const expired: IUserApiToken = {
		...live,
		id: 'token-2',
		name: 'Old agent',
		prefix: 'gzp_old00000',
		expiresAt: new Date(Date.now() - 864e5),
		lastUsedAt: new Date('2026-10-01T10:00:00.000Z')
	};
	const forever: IUserApiToken = { ...live, id: 'token-3', name: 'Forever', prefix: 'gzp_forever0', expiresAt: null };
	const plain = `gzp_${'a'.repeat(43)}`;

	let service: { list: jest.Mock; create: jest.Mock; revoke: jest.Mock };

	beforeEach(async () => {
		service = {
			list: jest.fn(() => of({ items: [live, expired, forever], total: 3 })),
			create: jest.fn(() => of({ ...live, token: plain })),
			revoke: jest.fn(() => of(undefined))
		};
		// Nebular, translations (a key renders as itself), the router and the icon pack come from jest.angular-defaults.ts.
		await TestBed.configureTestingModule({
			imports: [ApiTokensModule],
			providers: [{ provide: UserApiTokenService, useValue: service }]
		}).compileComponents();
	});

	const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	it('lists the tokens with their prefix', async () => {
		const fixture = TestBed.createComponent(ApiTokensComponent);
		await settle(fixture);
		const element: HTMLElement = fixture.nativeElement;

		const rows = element.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(3);
		expect(rows[0].textContent).toContain('Task agent');
		expect(rows[0].querySelector('code')?.textContent).toContain('gzp_abcd1234');
		expect(rows[0].textContent).toContain('USER_API_TOKENS.VALUES.NEVER_USED');
		expect(rows[1].querySelector('.expired')?.textContent).toContain('USER_API_TOKENS.VALUES.EXPIRED');
		expect(rows[2].textContent).toContain('USER_API_TOKENS.VALUES.NEVER_EXPIRES');
		expect(rows[0].querySelector('button[aria-label="USER_API_TOKENS.ACTIONS.REVOKE: Task agent"]')).not.toBeNull();
	});

	it('shows the empty state when there are none', async () => {
		service.list.mockReturnValue(of({ items: [], total: 0 }));

		const fixture = TestBed.createComponent(ApiTokensComponent);
		await settle(fixture);
		const element: HTMLElement = fixture.nativeElement;

		expect(element.querySelector('table')).toBeNull();
		expect(element.querySelector('.empty-state')?.textContent).toContain('USER_API_TOKENS.EMPTY.TITLE');
	});

	it('renders the create dialog with a name and the three expiries, starting at 90 days', async () => {
		const fixture = TestBed.createComponent(ApiTokenFormDialogComponent);
		await settle(fixture);
		const element: HTMLElement = fixture.nativeElement;

		expect(element.querySelector('input#api-token-name')).not.toBeNull();
		expect(element.querySelectorAll('nb-radio')).toHaveLength(3);
		expect(fixture.componentInstance.form.getRawValue().expiry).toBe(UserApiTokenExpiryEnum.DAYS_90);
		const create = Array.from(element.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('USER_API_TOKENS.ACTIONS.CREATE')
		);
		expect(create?.disabled).toBe(true);
	});

	it('shows the plain token once in the secret dialog, and closes only after it is acknowledged', async () => {
		const fixture = TestBed.createComponent(ApiTokenSecretDialogComponent);
		fixture.componentInstance.created = { ...live, token: plain };
		await settle(fixture);
		const element: HTMLElement = fixture.nativeElement;

		expect(element.querySelector('code.secret')?.textContent).toBe(plain);
		const close = Array.from(element.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('USER_API_TOKENS.SECRET_DIALOG.CLOSE')
		);
		expect(close?.disabled).toBe(true);

		const closeDialog = jest.spyOn(TestBed.inject(NbDialogRef), 'close');
		element.querySelector<HTMLInputElement>('nb-toggle input')?.click();
		await settle(fixture);
		expect(close?.disabled).toBe(false);
		close?.click();
		expect(closeDialog).toHaveBeenCalled();
	});
});
