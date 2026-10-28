import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountDeletionOutcomeEnum, IAccountDeletionPreview, IAccountDeletionResult } from '@gauzy/contracts';
import { AccountDeletionService } from './account-deletion.service';
import { useNoReferrer } from './referrer-policy';

/** The word the user types to confirm. */
export const DELETE_CONFIRMATION_WORD = 'DELETE';

/**
 * - `invalid`: the API answered 410 (or there is no token): the link can never be used again.
 * - `unavailable`: the link could not be checked (offline, 5xx, 429): it may still work, "Try again" re-checks it.
 * - `failed`: the deletion did not complete for a reason other than 410/409: the API released the link, "Try again"
 *   returns to the form.
 */
type ConfirmState = 'loading' | 'invalid' | 'unavailable' | 'ready' | 'deleting' | 'done' | 'failed';

/**
 * `/auth/delete-account/confirm?token=…` (inside the fragment): the page the deletion email links to.
 *
 * The token is read once and immediately removed from the address bar, kept only in memory. The page
 * shows what will be deleted (`verify`), and deletes only when the user confirms (`POST confirm`):
 * opening the link deletes nothing. No session is created at any point.
 */
@Component({
	selector: 'ngx-delete-account-confirm',
	templateUrl: './delete-account-confirm.component.html',
	styleUrls: ['./delete-account.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class NgxDeleteAccountConfirmComponent implements OnInit, OnDestroy {
	readonly confirmationWord = DELETE_CONFIRMATION_WORD;
	readonly outcomes = AccountDeletionOutcomeEnum;

	state: ConfirmState = 'loading';
	preview: IAccountDeletionPreview | null = null;
	result: IAccountDeletionResult | null = null;
	understood = false;
	typed = '';
	/** The API refused a confirmation because what the link deletes changed since the preview the user reviewed. */
	planChanged = false;

	private token: string | null = null;
	private readonly restoreReferrer: () => void;

	constructor(
		private readonly accountDeletionService: AccountDeletionService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly cdr: ChangeDetectorRef,
		@Inject(DOCUMENT) document: Document
	) {
		this.restoreReferrer = useNoReferrer(document);
	}

	async ngOnInit(): Promise<void> {
		this.token = this.route.snapshot.queryParamMap.get('token');
		// Out of the address bar (and so out of history, bookmarks and screenshots) before anything else.
		await this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });

		if (!this.token) {
			this.setState('invalid');
			return;
		}
		await this.loadPreview();
	}

	get canConfirm(): boolean {
		return this.state === 'ready' && this.understood && this.typed.trim() === DELETE_CONFIRMATION_WORD;
	}

	/** "Try again" after the link could not be checked: the token is still in memory, the address bar no longer has it. */
	async retryVerify(): Promise<void> {
		if (this.state !== 'unavailable' || !this.token) {
			return;
		}
		await this.loadPreview();
	}

	async confirm(): Promise<void> {
		if (!this.canConfirm || !this.token) {
			return;
		}
		this.setState('deleting');
		try {
			this.result = await this.accountDeletionService.confirm(this.token, this.preview?.planHash);
			this.token = null;
			this.planChanged = false;
			this.setState('done');
		} catch (error) {
			const status = error instanceof HttpErrorResponse ? error.status : undefined;
			if (status === 410) {
				this.setState('invalid');
			} else if (status === 409) {
				// The accounts or their outcomes changed since the preview (say, a member joined or left): nothing was
				// deleted. Show what the link deletes now and ask for the box and the word again.
				this.planChanged = true;
				this.understood = false;
				this.typed = '';
				await this.loadPreview();
			} else {
				this.setState('failed');
			}
		}
	}

	/** "Try again" after a failed deletion: back to the form. The API released the link; the token is still in memory. */
	retryConfirm(): void {
		if (this.state !== 'failed' || !this.token) {
			return;
		}
		this.setState('ready');
	}

	/** Leaves through the sign-out route, so a session this browser still holds for the deleted account goes too. */
	finish(): void {
		this.router.navigate(['/auth/logout']);
	}

	/** `verify`: only a 410 means the link is unusable; any other failure may pass, so it can be retried. */
	private async loadPreview(): Promise<void> {
		this.setState('loading');
		try {
			this.preview = await this.accountDeletionService.verify(this.token);
			this.setState('ready');
		} catch (error) {
			this.setState(error instanceof HttpErrorResponse && error.status === 410 ? 'invalid' : 'unavailable');
		}
	}

	private setState(state: ConfirmState): void {
		this.state = state;
		this.cdr.markForCheck();
	}

	ngOnDestroy(): void {
		this.token = null;
		this.restoreReferrer();
	}
}
