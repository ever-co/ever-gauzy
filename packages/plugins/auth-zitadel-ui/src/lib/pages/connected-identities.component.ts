import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { AuthZitadelUiService, EverIdIdentity, EverIdLinkPreview } from '../services/auth-zitadel-ui.service';

/** Error codes the API puts in the URL of this page (never anything personal). */
const KNOWN_ERRORS = ['email_unverified', 'reauth_required', 'link_failed', 'sign_in_failed', 'cancelled', 'expired'];

/**
 * Settings > Connected identities: the signed-in person connects an Ever ID to this account (after a
 * fresh Ever ID sign-in and a confirmation that shows both addresses), sees the connected ones, and
 * can disconnect them. Accounts with the same address in other workspaces are offered not ticked and
 * are linked only with Gauzy's own one-time e-mail code.
 */
@Component({
	selector: 'ngx-ever-id-connected-identities',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, FormsModule, NbAlertModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, TranslateModule],
	template: `
		<nb-card>
			<nb-card-header>{{ 'AUTH_ZITADEL.SETTINGS.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@if (enabled === false) {
					<p>{{ 'AUTH_ZITADEL.SETTINGS.NOT_ENABLED' | translate }}</p>
				} @else if (enabled) {
					@if (error) {
						<nb-alert status="danger" role="alert">{{ 'AUTH_ZITADEL.ERRORS.' + error | translate }}</nb-alert>
					}
					@if (notice) {
						<nb-alert status="success" role="status">{{ notice | translate }}</nb-alert>
					}
					@if (preview) {
						<section class="confirm-link">
							<h3>{{ 'AUTH_ZITADEL.SETTINGS.CONFIRM_TITLE' | translate }}</h3>
							<p>{{ 'AUTH_ZITADEL.SETTINGS.CONFIRM_DESCRIPTION' | translate }}</p>
							<dl>
								<dt>{{ 'AUTH_ZITADEL.SETTINGS.EVER_ID_EMAIL' | translate }}</dt>
								<dd>{{ preview.everIdEmail }}</dd>
								<dt>{{ 'AUTH_ZITADEL.SETTINGS.ACCOUNT_EMAIL' | translate }}</dt>
								<dd>{{ preview.accountEmail }}</dd>
							</dl>
							@if (preview.siblings.length) {
								<p>{{ 'AUTH_ZITADEL.SETTINGS.SIBLINGS' | translate }}</p>
								@for (sibling of preview.siblings; track sibling.userId) {
									<nb-checkbox
										[checked]="selectedSiblings.has(sibling.userId)"
										(checkedChange)="toggleSibling(sibling.userId, $event)"
									>
										{{ sibling.tenantName }}
									</nb-checkbox>
								}
							}
							@if (codeRequired) {
								<p>{{ 'AUTH_ZITADEL.SETTINGS.CODE_SENT' | translate }}</p>
								<input
									nbInput
									fullWidth
									name="code"
									autocomplete="one-time-code"
									[placeholder]="'AUTH_ZITADEL.CONFIRM.CODE' | translate"
									[(ngModel)]="code"
									maxlength="64"
								/>
							}
							<div class="actions">
								<button nbButton status="primary" type="button" [disabled]="busy || (codeRequired && !code.trim())" (click)="confirmLink()">
									{{ 'AUTH_ZITADEL.SETTINGS.CONFIRM' | translate }}
								</button>
								<button nbButton ghost type="button" [disabled]="busy" (click)="cancelLink()">
									{{ 'AUTH_ZITADEL.SETTINGS.CANCEL' | translate }}
								</button>
							</div>
						</section>
					} @else {
						@if (identities.length) {
							<ul class="identities">
								@for (identity of identities; track identity.id) {
									<li>
										<div>
											<strong>{{ identity.emailAtLink || identity.subjectMasked }}</strong>
											<small> · {{ 'AUTH_ZITADEL.SETTINGS.LINKED_ON' | translate }} {{ identity.linkedAt | date: 'mediumDate' }}</small>
										</div>
										<button nbButton size="small" status="danger" ghost type="button" [disabled]="busy" (click)="disconnect(identity)">
											{{ 'AUTH_ZITADEL.SETTINGS.DISCONNECT' | translate }}
										</button>
									</li>
								}
							</ul>
						} @else {
							<p>{{ 'AUTH_ZITADEL.SETTINGS.NONE' | translate }}</p>
						}
						<button nbButton status="primary" type="button" [disabled]="busy" (click)="connect()">
							{{ 'AUTH_ZITADEL.SETTINGS.CONNECT' | translate }}
						</button>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.identities {
				list-style: none;
				padding: 0;
			}
			.identities li {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 8px 0;
			}
			.actions {
				display: flex;
				gap: 8px;
				margin-top: 12px;
			}
			.confirm-link nb-checkbox {
				display: block;
			}
		`
	]
})
export class ConnectedIdentitiesComponent implements OnInit {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly api = inject(AuthZitadelUiService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	enabled: boolean | null = null;
	identities: EverIdIdentity[] = [];
	preview: EverIdLinkPreview | null = null;
	selectedSiblings = new Set<string>();
	codeRequired = false;
	code = '';
	error: string | null = null;
	notice: string | null = null;
	busy = false;
	private linkKey = '';

	ngOnInit(): void {
		const { linked, error } = this.route.snapshot.queryParams;
		this.api
			.config()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((config) => {
				this.enabled = config.enabled;
				this.cdr.markForCheck();
				if (!config.enabled) {
					return;
				}
				if (error) {
					this.error = KNOWN_ERRORS.includes(error) ? error : 'link_failed';
				}
				if (linked) {
					this.loadPreview(linked);
				}
				this.loadIdentities();
			});
	}

	connect(): void {
		this.busy = true;
		this.api
			.startLink()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({ url }) => window.location.assign(url),
				error: () => this.fail('link_failed')
			});
	}

	toggleSibling(userId: string, checked: boolean): void {
		if (checked) {
			this.selectedSiblings.add(userId);
		} else {
			this.selectedSiblings.delete(userId);
		}
		this.codeRequired = false;
	}

	confirmLink(): void {
		this.busy = true;
		this.api
			.linkConfirm(this.linkKey, [...this.selectedSiblings], this.codeRequired ? this.code.trim() : undefined)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.busy = false;
					if (result.code_required) {
						this.codeRequired = true;
					} else {
						this.finishLink('AUTH_ZITADEL.SETTINGS.LINKED');
					}
					this.cdr.markForCheck();
				},
				error: (failure) => {
					this.busy = false;
					if (failure?.status === 409) {
						this.error = 'link_failed';
					} else if (failure?.status === 410) {
						this.error = 'expired';
						this.preview = null;
					} else {
						this.error = 'sign_in_failed';
					}
					this.cdr.markForCheck();
				}
			});
	}

	cancelLink(): void {
		this.finishLink(null);
	}

	disconnect(identity: EverIdIdentity): void {
		this.busy = true;
		this.api
			.unlink(identity.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.busy = false;
					this.notice = 'AUTH_ZITADEL.SETTINGS.DISCONNECTED';
					this.loadIdentities();
				},
				error: (failure) => {
					this.busy = false;
					this.notice = null;
					this.error = failure?.status === 409 ? 'last_signin_method' : 'link_failed';
					this.cdr.markForCheck();
				}
			});
	}

	private loadPreview(key: string): void {
		this.linkKey = key;
		this.api
			.linkPreview(key)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (preview) => {
					this.preview = preview;
					this.cdr.markForCheck();
				},
				error: () => this.fail('expired')
			});
	}

	private loadIdentities(): void {
		this.api
			.identities()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (identities) => {
					this.identities = identities ?? [];
					this.cdr.markForCheck();
				},
				error: () => this.fail('link_failed')
			});
	}

	private finishLink(notice: string | null): void {
		this.preview = null;
		this.codeRequired = false;
		this.code = '';
		this.selectedSiblings.clear();
		this.notice = notice;
		this.router.navigate([], { relativeTo: this.route, queryParams: {} });
		this.loadIdentities();
	}

	private fail(code: string): void {
		this.busy = false;
		this.error = code;
		this.cdr.markForCheck();
	}
}
