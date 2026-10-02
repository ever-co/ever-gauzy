import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { IWorkspaceResponse } from '@gauzy/contracts';
import { EverIdWorkspacesComponent } from '../components/ever-id-workspaces.component';
import { AuthZitadelUiService, EverIdWorkspaceResponse } from '../services/auth-zitadel-ui.service';
import { EverIdSignInService } from '../services/ever-id-sign-in.service';

/** Error codes the API puts in the URL (never anything personal). */
const KNOWN_ERRORS = new Set(['email_unverified', 'sign_in_failed', 'cancelled', 'expired']);

/**
 * `#/auth/ever-id?handoff=…`: redeems the one-time key of an Ever ID sign-in, then signs in to the
 * chosen workspace through the unchanged workspace sign-in. One workspace signs in directly.
 */
@Component({
	selector: 'ngx-ever-id-handoff',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbAlertModule, NbButtonModule, NbCardModule, RouterLink, TranslateModule, EverIdWorkspacesComponent],
	template: `
		<section class="ever-id-page">
			<h2 class="title">{{ 'AUTH_ZITADEL.HANDOFF.TITLE' | translate }}</h2>
			@if (error) {
				<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.' + error | translate }}</nb-alert>
				<a nbButton status="primary" routerLink="/auth/login">{{ 'AUTH_ZITADEL.BACK_TO_LOGIN' | translate }}</a>
			} @else if (response) {
				@if (!response.workspaces?.length && !response.blocked_workspaces?.length) {
					<nb-alert status="warning">{{ 'AUTH_ZITADEL.HANDOFF.NO_WORKSPACE' | translate }}</nb-alert>
				}
				<ngx-ever-id-workspaces [response]="response" [busy]="busy" (selected)="signIn($event)"></ngx-ever-id-workspaces>
			} @else {
				<p>{{ 'AUTH_ZITADEL.HANDOFF.SIGNING_IN' | translate }}</p>
			}
		</section>
	`
})
export class EverIdHandoffComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly api = inject(AuthZitadelUiService);
	private readonly signInService = inject(EverIdSignInService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	error: string | null = null;
	response: EverIdWorkspaceResponse | null = null;
	busy = false;

	ngOnInit(): void {
		const { handoff, error } = this.route.snapshot.queryParams;
		if (error) {
			this.fail(error);
			return;
		}
		if (!handoff) {
			this.fail('sign_in_failed');
			return;
		}
		this.api
			.redeemHandoff(handoff)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (record) => {
					if (record?.kind !== 'workspaces') {
						this.fail('sign_in_failed');
						return;
					}
					this.response = record.response;
					this.cdr.markForCheck();
					if (record.response.total_workspaces === 1) {
						this.signIn(record.response.workspaces[0]);
					}
				},
				error: (failure) => this.fail(failure?.status === 410 ? 'expired' : 'sign_in_failed')
			});
	}

	signIn(workspace: IWorkspaceResponse): void {
		if (!this.response || this.busy) {
			return;
		}
		this.busy = true;
		this.signInService
			.signIn(this.response.confirmed_email, workspace, this.response.redirect)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				error: () => {
					this.busy = false;
					this.fail('sign_in_failed');
				}
			});
	}

	private fail(code: string): void {
		this.error = KNOWN_ERRORS.has(code) ? code : 'sign_in_failed';
		this.cdr.markForCheck();
	}
}
