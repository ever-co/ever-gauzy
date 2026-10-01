import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { IWorkspaceResponse } from '@gauzy/contracts';
import { EverIdWorkspacesComponent } from '../components/ever-id-workspaces.component';
import { AuthZitadelUiService, EverIdWorkspaceResponse } from '../services/auth-zitadel-ui.service';
import { EverIdSignInService } from '../services/ever-id-sign-in.service';

/**
 * `#/auth/ever-id/confirm?handoff=…`: an Ever ID matched an existing account by its verified e-mail.
 * Gauzy has e-mailed its own one-time code to that address; the Ever ID is connected only after the
 * code is entered here.
 */
@Component({
	selector: 'ngx-ever-id-confirm',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbAlertModule, NbButtonModule, NbInputModule, RouterLink, TranslateModule, EverIdWorkspacesComponent],
	template: `
		<section class="ever-id-page">
			<h2 class="title">{{ 'AUTH_ZITADEL.CONFIRM.TITLE' | translate }}</h2>
			@if (expired) {
				<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.expired' | translate }}</nb-alert>
				<a nbButton status="primary" routerLink="/auth/login">{{ 'AUTH_ZITADEL.BACK_TO_LOGIN' | translate }}</a>
			} @else if (response && !response.workspaces.length) {
				<nb-alert status="warning" role="alert">{{ 'AUTH_ZITADEL.CONFIRM.NO_WORKSPACE' | translate }}</nb-alert>
				<a nbButton status="primary" routerLink="/auth/login">{{ 'AUTH_ZITADEL.BACK_TO_LOGIN' | translate }}</a>
			} @else if (response) {
				<ngx-ever-id-workspaces [response]="response" [busy]="busy" (selected)="signIn($event)"></ngx-ever-id-workspaces>
			} @else {
				<p>{{ 'AUTH_ZITADEL.CONFIRM.DESCRIPTION' | translate }}</p>
				@if (wrongCode) {
					<nb-alert status="warning" role="alert">{{ 'AUTH_ZITADEL.CONFIRM.WRONG_CODE' | translate }}</nb-alert>
				}
				@if (failed) {
					<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.try_again' | translate }}</nb-alert>
				}
				<form (ngSubmit)="submit()" class="code-form">
					<input
						nbInput
						fullWidth
						name="code"
						autocomplete="one-time-code"
						[attr.aria-label]="'AUTH_ZITADEL.CONFIRM.CODE' | translate"
						[placeholder]="'AUTH_ZITADEL.CONFIRM.CODE' | translate"
						[(ngModel)]="code"
						required
						maxlength="64"
					/>
					<button nbButton status="primary" fullWidth type="submit" [disabled]="!code.trim() || busy">
						{{ 'AUTH_ZITADEL.CONFIRM.SUBMIT' | translate }}
					</button>
				</form>
			}
		</section>
	`,
	styles: [
		`
			.code-form {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
		`
	]
})
export class EverIdConfirmComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly api = inject(AuthZitadelUiService);
	private readonly signInService = inject(EverIdSignInService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	code = '';
	busy = false;
	wrongCode = false;
	failed = false;
	expired = false;
	response: EverIdWorkspaceResponse | null = null;
	private handoff = '';

	ngOnInit(): void {
		this.handoff = this.route.snapshot.queryParams['handoff'] ?? '';
		this.expired = !this.handoff;
	}

	submit(): void {
		if (!this.code.trim() || this.busy) {
			return;
		}
		this.busy = true;
		this.wrongCode = false;
		this.failed = false;
		this.api
			.confirm(this.handoff, this.code.trim())
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (response) => {
					this.busy = false;
					this.response = response;
					this.cdr.markForCheck();
					if (response.total_workspaces === 1) {
						this.signIn(response.workspaces[0]);
					}
				},
				error: (failure) => {
					this.busy = false;
					if (failure?.status === 410) {
						this.expired = true;
					} else if (failure?.status === 401) {
						this.wrongCode = true;
					} else {
						// A server or network problem: the code may well be right, so it can be tried again.
						this.failed = true;
					}
					this.cdr.markForCheck();
				}
			});
	}

	signIn(workspace: IWorkspaceResponse): void {
		// Also reached automatically for a single workspace: never send a second sign-in.
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
					this.expired = true;
					this.cdr.markForCheck();
				}
			});
	}
}
