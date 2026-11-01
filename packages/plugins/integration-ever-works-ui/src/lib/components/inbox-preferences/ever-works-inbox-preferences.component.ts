import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbAlertModule, NbButtonModule, NbCardModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { merge, Observable, of, Subject } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type {
	EverWorksInboxKind,
	EverWorksInboxOrganizationState,
	EverWorksInboxPreferencesView
} from '../../services/ever-works.service';
import { EVER_WORKS_INBOX_KINDS, EverWorksUiService } from '../../services/ever-works.service';
import { errorText } from '../shared/ever-works-ui.utils';

/** What the page shows. */
export type EverWorksInboxPreferencesPageView = 'loading' | 'ready' | 'unavailable' | 'error';

/** The kinds the page names and describes (another one, from a newer API, is shown by its name). */
const KNOWN_KINDS: ReadonlySet<string> = new Set(EVER_WORKS_INBOX_KINDS);

/** Why an organization's items are not sent, as the page translates it (another reason is shown as it is). */
const KNOWN_REASONS: ReadonlySet<string> = new Set([
	'not_paired',
	'mapping_disabled',
	'direction',
	'sync_setting_off',
	'connection_inactive',
	'missing_scope'
]);

/**
 * Settings → Ever Works inbox (`/pages/settings/ever-works-inbox`): which kinds of my Gauzy Inbox items are sent to
 * Ever Works (every kind is, until I change it), and for each organization of the tenant mapped to Ever Works whether
 * my items are sent there now, and why not. Any signed-in user with `INBOX_VIEW`, for their own account; a 404 means
 * the API does not load the Ever Works plugin (`EVER_WORKS_ENABLED` is not `true`, the default).
 */
@Component({
	selector: 'ngx-ever-works-inbox-preferences',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbAlertModule, NbButtonModule, NbCardModule, NbToggleModule, TranslatePipe],
	template: `
		<nb-card>
			<nb-card-header>{{ 'EVER_WORKS.INBOX_PREFERENCES.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@switch (view) {
					@case ('loading') {
						<p data-test="loading">{{ 'EVER_WORKS.COMMON.LOADING' | translate }}</p>
					}
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'EVER_WORKS.INBOX_PREFERENCES.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							loadError || ('EVER_WORKS.ERROR' | translate)
						}}</nb-alert>
						<button nbButton ghost size="small" type="button" data-test="retry" (click)="load()">
							{{ 'EVER_WORKS.RETRY' | translate }}
						</button>
					}
					@case ('ready') {
						<p data-test="intro">{{ 'EVER_WORKS.INBOX_PREFERENCES.INTRO' | translate }}</p>
						@if (error) {
							<nb-alert status="danger" role="alert" data-test="save-error">{{ error }}</nb-alert>
						}
						@if (saved) {
							<nb-alert status="success" role="status" data-test="saved">{{
								'EVER_WORKS.COMMON.SAVED' | translate
							}}</nb-alert>
						}
						<ul class="kinds" data-test="kinds">
							@for (kind of available; track kind) {
								<li [attr.data-test]="'kind-' + kind">
									<nb-toggle
										[attr.data-test]="'toggle-' + kind"
										[(ngModel)]="kinds[kind]"
										[disabled]="busy"
										(ngModelChange)="saved = false"
									>
										{{ kindLabel(kind) | translate }}
									</nb-toggle>
									@if (kindHint(kind); as hint) {
										<small class="hint">{{ hint | translate }}</small>
									}
								</li>
							}
						</ul>
						@if (!updatedAt) {
							<p class="hint" data-test="defaults">
								{{ 'EVER_WORKS.INBOX_PREFERENCES.DEFAULTS' | translate }}
							</p>
						} @else if (nothingSent()) {
							<p class="hint" data-test="nothing-sent">
								{{ 'EVER_WORKS.INBOX_PREFERENCES.NOTHING_SENT' | translate }}
							</p>
						}
						<div class="actions">
							<button
								nbButton
								status="primary"
								type="button"
								data-test="save"
								[disabled]="busy || !hasChanges()"
								(click)="save()"
							>
								{{ 'EVER_WORKS.COMMON.SAVE' | translate }}
							</button>
						</div>
						<h6>{{ 'EVER_WORKS.INBOX_PREFERENCES.ORGANIZATIONS' | translate }}</h6>
						@if (!organizations.length) {
							<p data-test="no-organizations">
								{{ 'EVER_WORKS.INBOX_PREFERENCES.NO_ORGANIZATIONS' | translate }}
							</p>
						} @else {
							<table class="table" data-test="organizations">
								<thead>
									<tr>
										<th>{{ 'EVER_WORKS.INBOX_PREFERENCES.ORGANIZATION' | translate }}</th>
										<th>{{ 'EVER_WORKS.INBOX_PREFERENCES.STATE' | translate }}</th>
									</tr>
								</thead>
								<tbody>
									@for (row of organizations; track row.organizationId) {
										<tr [attr.data-test]="'organization-' + row.organizationId">
											<td>{{ row.organizationName || row.organizationId }}</td>
											<td>
												@if (row.sending) {
													<span
														class="sending"
														[attr.data-test]="'sending-' + row.organizationId"
														>{{ 'EVER_WORKS.INBOX_PREFERENCES.SENDING' | translate }}</span
													>
												} @else {
													<span [attr.data-test]="'not-sending-' + row.organizationId">{{
														'EVER_WORKS.INBOX_PREFERENCES.NOT_SENDING' | translate
													}}</span>
													@if (row.reason) {
														<small
															class="reason"
															[attr.data-test]="'reason-' + row.organizationId"
															>{{ reasonLabel(row.reason) | translate }}</small
														>
													}
												}
											</td>
										</tr>
									}
								</tbody>
							</table>
						}
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.kinds {
				list-style: none;
				padding-left: 0;
			}
			.kinds li {
				margin-bottom: 0.75rem;
			}
			.hint,
			.reason {
				display: block;
				opacity: 0.8;
			}
			.kinds .hint {
				margin-top: 0.25rem;
			}
			.actions {
				margin: 1rem 0 1.5rem;
			}
			.sending {
				color: var(--color-success-default, #00a35c);
			}
		`
	]
})
export class EverWorksInboxPreferencesComponent implements OnInit {
	private readonly api = inject(EverWorksUiService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	view: EverWorksInboxPreferencesPageView = 'loading';
	/** The kinds, in the API's display order. */
	available: EverWorksInboxKind[] = [];
	/** The switches as they are on the page (saved or not). */
	kinds: Record<string, boolean> = {};
	updatedAt: string | null = null;
	organizations: EverWorksInboxOrganizationState[] = [];
	busy = false;
	saved = false;
	/** Why the save failed (the API's message). */
	error: string | null = null;
	/** Why the page could not be read (the API's message), for a failure that is not a 404. */
	loadError: string | null = null;
	/** The kinds as last saved: only what differs from them is sent. */
	private stored: Record<string, boolean> = {};
	private readonly reload$ = new Subject<void>();

	ngOnInit(): void {
		// The first read and every retry share one switchMap: the last one wins.
		merge(of(undefined), this.reload$)
			.pipe(
				switchMap(() => {
					this.view = 'loading';
					this.loadError = null;
					this.cdr.markForCheck();
					return this.read$();
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((result) => {
				if ('view' in result) {
					this.use(result.view);
					this.view = 'ready';
				} else {
					this.view = result.error?.status === 404 ? 'unavailable' : 'error';
					this.loadError = result.error?.status === 404 ? null : errorText(result.error);
				}
				this.cdr.markForCheck();
			});
	}

	/** Reads the page again (a retry). */
	load(): void {
		this.reload$.next();
	}

	kindLabel(kind: string): string {
		return KNOWN_KINDS.has(kind) ? `EVER_WORKS.INBOX_KINDS.${kind}.LABEL` : kind;
	}

	kindHint(kind: string): string | null {
		return KNOWN_KINDS.has(kind) ? `EVER_WORKS.INBOX_KINDS.${kind}.HINT` : null;
	}

	reasonLabel(reason: string): string {
		return KNOWN_REASONS.has(reason) ? `EVER_WORKS.INBOX_PREFERENCES.REASONS.${reason}` : reason;
	}

	/** A switch differs from what is saved. */
	hasChanges(): boolean {
		return this.available.some((kind) => !!this.kinds[kind] !== !!this.stored[kind]);
	}

	/** Every kind is off (as saved): nothing of mine goes to Ever Works. */
	nothingSent(): boolean {
		return this.available.length > 0 && this.available.every((kind) => !this.stored[kind]);
	}

	/** Sends the switches that changed; the answer is the page as saved. */
	save(): void {
		const changed = Object.fromEntries(
			this.available
				.filter((kind) => !!this.kinds[kind] !== !!this.stored[kind])
				.map((kind) => [kind, !!this.kinds[kind]])
		) as Partial<Record<EverWorksInboxKind, boolean>>;
		if (!Object.keys(changed).length) return;
		this.busy = true;
		this.saved = false;
		this.error = null;
		this.api
			.updateInboxPreferences(changed)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (view) => {
					this.busy = false;
					this.use(view);
					this.saved = true;
					this.cdr.markForCheck();
				},
				error: (error) => {
					this.busy = false;
					this.error = errorText(error);
					this.cdr.markForCheck();
				}
			});
	}

	private read$(): Observable<{ view: EverWorksInboxPreferencesView } | { error: HttpErrorResponse }> {
		return this.api.inboxPreferences().pipe(
			map((view) => ({ view })),
			catchError((error: HttpErrorResponse) => of({ error }))
		);
	}

	private use(view: EverWorksInboxPreferencesView): void {
		// The API's order; a kind it lists without a value is on (the default).
		this.available = view?.available?.length ? [...view.available] : [...EVER_WORKS_INBOX_KINDS];
		this.stored = Object.fromEntries(this.available.map((kind) => [kind, view?.kinds?.[kind] !== false]));
		this.kinds = { ...this.stored };
		this.updatedAt = view?.updatedAt ?? null;
		this.organizations = view?.organizations ?? [];
	}
}
