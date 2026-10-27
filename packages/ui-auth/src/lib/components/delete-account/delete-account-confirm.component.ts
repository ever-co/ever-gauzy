import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountDeletionOutcomeEnum, IAccountDeletionPreview, IAccountDeletionResult } from '@gauzy/contracts';
import { AccountDeletionService } from './account-deletion.service';
import { useNoReferrer } from './referrer-policy';

/** The word the user types to confirm. */
export const DELETE_CONFIRMATION_WORD = 'DELETE';

type ConfirmState = 'loading' | 'invalid' | 'ready' | 'deleting' | 'done' | 'failed';

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
		try {
			this.preview = await this.accountDeletionService.verify(this.token);
			this.setState('ready');
		} catch {
			this.setState('invalid');
		}
	}

	get canConfirm(): boolean {
		return this.state === 'ready' && this.understood && this.typed.trim() === DELETE_CONFIRMATION_WORD;
	}

	async confirm(): Promise<void> {
		if (!this.canConfirm || !this.token) {
			return;
		}
		this.setState('deleting');
		try {
			this.result = await this.accountDeletionService.confirm(this.token);
			this.token = null;
			this.setState('done');
		} catch (error) {
			this.setState(error instanceof HttpErrorResponse && error.status === 410 ? 'invalid' : 'failed');
		}
	}

	/** Leaves through the sign-out route, so a session this browser still holds for the deleted account goes too. */
	finish(): void {
		this.router.navigate(['/auth/logout']);
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
