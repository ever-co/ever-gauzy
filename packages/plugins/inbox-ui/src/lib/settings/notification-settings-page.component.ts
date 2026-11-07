import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbButtonModule, NbCardModule, NbInputModule, NbSelectModule, NbSpinnerModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { EmployeeNotificationEmailMode, EmployeeNotificationTypeEnum, ID, IEmployeeNotificationPreferences, IEmployeeNotificationSetting } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import {
	IInboxNotificationSettingInput,
	IInboxNotificationSettingScope,
	InboxNotificationSettingsService
} from '../services/inbox-notification-settings.service';
import { apiErrorMessage, viewOfLoadError } from './inbox-settings.helpers';
import {
	browserTimeZone,
	DEFAULT_QUIET_HOURS,
	defaultEmailModeOf,
	digestHourOf,
	emailModeOf,
	hourLabelOf,
	isKindOn,
	isTimeOfDay,
	NOTIFICATION_EMAIL_MODES,
	NOTIFICATION_KIND_ROWS,
	NotificationSettingKey,
	ownEmailModeOf,
	preferencesOf,
	quietHoursOf,
	withPreferencePatch
} from './notification-settings.helpers';

/** What the page shows: the views of the other settings pages, and "no employee" (a user who is not one here). */
export type NotificationSettingsView = 'loading' | 'ready' | 'no-employee' | 'forbidden' | 'error';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * Settings -> Notifications (`/pages/settings/notifications`, the Inbox spec "Preferences and channels", T15): the
 * employee's own notification setting — one switch per kind, the email mode per kind and for every kind (at once,
 * in the daily digest, never), the quiet hours (no email between two times, in the browser's time zone) and the hour
 * of the daily digest. Each change saves at once (optimistically where the row exists) and comes back if the API
 * refuses it. The delivery itself is the API's (`GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED`); the preferences are kept
 * either way.
 */
@Component({
	selector: 'ngx-inbox-notification-settings-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbAlertModule, NbButtonModule, NbCardModule, NbInputModule, NbSelectModule, NbSpinnerModule, NbToggleModule, TranslatePipe],
	template: `
		<nb-card class="page" data-test="notification-settings-page">
			<nb-card-header>
				<h4>{{ 'INBOX.NOTIFICATION_SETTINGS.TITLE' | translate }}</h4>
				<p class="subtitle">{{ 'INBOX.NOTIFICATION_SETTINGS.SUBTITLE' | translate }}</p>
			</nb-card-header>
			<nb-card-body>
				@switch (view()) {
					@case ('loading') {
						<div class="loading" data-test="loading" [nbSpinner]="true"></div>
					}
					@case ('no-employee') {
						<p data-test="no-employee">{{ 'INBOX.NOTIFICATION_SETTINGS.NO_EMPLOYEE' | translate }}</p>
					}
					@case ('forbidden') {
						<p data-test="forbidden">{{ 'INBOX.NOTIFICATION_SETTINGS.FORBIDDEN' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							'INBOX.NOTIFICATION_SETTINGS.LOAD_ERROR' | translate
						}}</nb-alert>
						<button nbButton size="small" type="button" data-test="retry" (click)="load()">
							{{ 'INBOX.RETRY' | translate }}
						</button>
					}
					@default {
						<section class="group" data-test="kinds">
							<h5>{{ 'INBOX.NOTIFICATION_SETTINGS.KINDS_TITLE' | translate }}</h5>
							<p class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.KINDS_HINT' | translate }}</p>
							@for (row of kinds; track row.key) {
								<div class="row" [attr.data-test]="'kind-' + row.key">
									<div class="text">
										<span class="label">{{ 'INBOX.NOTIFICATION_SETTINGS.KINDS.' + row.labelKey + '.TITLE' | translate }}</span>
										<span class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.KINDS.' + row.labelKey + '.TEXT' | translate }}</span>
									</div>
									<div class="controls">
										@if (isOn(row.key)) {
											<nb-select
												size="small"
												[attr.data-test]="'mode-' + row.key"
												[attr.aria-label]="'INBOX.NOTIFICATION_SETTINGS.MODE_LABEL' | translate"
												[selected]="ownModeOf(row.type)"
												[disabled]="busy().has('preferences')"
												(selectedChange)="setKindMode(row.type, $event)"
											>
												<nb-option [value]="'default'">{{ 'INBOX.NOTIFICATION_SETTINGS.MODE.default' | translate: { mode: ('INBOX.NOTIFICATION_SETTINGS.MODE.' + defaultMode() | translate) } }}</nb-option>
												@for (mode of modes; track mode) {
													<nb-option [value]="mode">{{ 'INBOX.NOTIFICATION_SETTINGS.MODE.' + mode | translate }}</nb-option>
												}
											</nb-select>
										}
										<nb-toggle
											[attr.data-test]="'switch-' + row.key"
											[checked]="isOn(row.key)"
											[disabled]="busy().has(row.key)"
											(checkedChange)="setKind(row.key, $event)"
										></nb-toggle>
									</div>
								</div>
							}
						</section>
						<section class="group" data-test="email">
							<h5>{{ 'INBOX.NOTIFICATION_SETTINGS.EMAIL_TITLE' | translate }}</h5>
							<p class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.EMAIL_HINT' | translate }}</p>
							<div class="row" data-test="email-default">
								<div class="text">
									<span class="label">{{ 'INBOX.NOTIFICATION_SETTINGS.DEFAULT_LABEL' | translate }}</span>
									<span class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.DEFAULT_TEXT' | translate }}</span>
								</div>
								<div class="controls">
									<nb-select
										size="small"
										data-test="mode-default"
										[selected]="defaultMode()"
										[disabled]="busy().has('preferences')"
										(selectedChange)="setDefaultMode($event)"
									>
										@for (mode of modes; track mode) {
											<nb-option [value]="mode">{{ 'INBOX.NOTIFICATION_SETTINGS.MODE.' + mode | translate }}</nb-option>
										}
									</nb-select>
								</div>
							</div>
						</section>
						<section class="group" data-test="quiet">
							<h5>{{ 'INBOX.NOTIFICATION_SETTINGS.QUIET_TITLE' | translate }}</h5>
							<div class="row" data-test="quiet-hours">
								<div class="text">
									<span class="label">{{ 'INBOX.NOTIFICATION_SETTINGS.QUIET_LABEL' | translate }}</span>
									<span class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.QUIET_TEXT' | translate: { timeZone: timeZone() } }}</span>
								</div>
								<div class="controls">
									@if (quietHours(); as window) {
										<label class="time">
											<span>{{ 'INBOX.NOTIFICATION_SETTINGS.QUIET_FROM' | translate }}</span>
											<input
												nbInput
												fieldSize="small"
												type="time"
												data-test="quiet-start"
												[value]="window.start"
												[disabled]="busy().has('preferences')"
												(change)="setQuietHour('start', $event)"
											/>
										</label>
										<label class="time">
											<span>{{ 'INBOX.NOTIFICATION_SETTINGS.QUIET_TO' | translate }}</span>
											<input
												nbInput
												fieldSize="small"
												type="time"
												data-test="quiet-end"
												[value]="window.end"
												[disabled]="busy().has('preferences')"
												(change)="setQuietHour('end', $event)"
											/>
										</label>
									}
									<nb-toggle
										data-test="quiet-switch"
										[checked]="!!quietHours()"
										[disabled]="busy().has('preferences')"
										(checkedChange)="toggleQuietHours($event)"
									></nb-toggle>
								</div>
							</div>
							<div class="row" data-test="digest-hour">
								<div class="text">
									<span class="label">{{ 'INBOX.NOTIFICATION_SETTINGS.DIGEST_LABEL' | translate }}</span>
									<span class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.DIGEST_TEXT' | translate }}</span>
								</div>
								<div class="controls">
									<nb-select
										size="small"
										data-test="digest-select"
										[selected]="digestHour()"
										[disabled]="busy().has('preferences')"
										(selectedChange)="setDigestHour($event)"
									>
										@for (hour of hours; track hour) {
											<nb-option [value]="hour">{{ hourLabel(hour) }}</nb-option>
										}
									</nb-select>
								</div>
							</div>
						</section>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			nb-card-header h4 {
				margin: 0;
			}
			.subtitle,
			.hint {
				margin: 0.25rem 0 0;
				font-size: 0.85rem;
				opacity: 0.75;
			}
			.group {
				margin-bottom: 1.5rem;
			}
			.group h5 {
				margin: 0 0 0.25rem;
			}
			.row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 1rem;
				padding: 0.75rem 0;
				border-bottom: 1px solid var(--border-basic-color-3, #edf1f7);
			}
			.row:last-child {
				border-bottom: 0;
			}
			.text {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.label {
				font-weight: 600;
			}
			.controls {
				display: flex;
				flex-wrap: wrap;
				justify-content: flex-end;
				align-items: center;
				gap: 0.75rem;
			}
			.time {
				display: flex;
				align-items: center;
				gap: 0.4rem;
				font-size: 0.85rem;
			}
			.loading {
				min-height: 8rem;
			}
		`
	]
})
export class InboxNotificationSettingsPageComponent implements OnInit {
	private readonly api = inject(InboxNotificationSettingsService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly kinds = NOTIFICATION_KIND_ROWS;
	protected readonly modes = NOTIFICATION_EMAIL_MODES;
	protected readonly hours = HOURS;

	readonly view = signal<NotificationSettingsView>('loading');
	readonly setting = signal<IEmployeeNotificationSetting | null>(null);
	/** What is being saved: a kind's key, or `preferences`. */
	readonly busy = signal<ReadonlySet<string>>(new Set());
	readonly preferences = computed(() => preferencesOf(this.setting()));
	readonly defaultMode = computed(() => defaultEmailModeOf(this.preferences()));
	readonly quietHours = computed(() => quietHoursOf(this.preferences()));
	readonly digestHour = computed(() => digestHourOf(this.preferences()));
	readonly timeZone = computed(() => this.quietHours()?.timeZone || browserTimeZone());

	private scope: IInboxNotificationSettingScope | null = null;

	ngOnInit(): void {
		this.scopes()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((scope) => {
				this.scope = scope;
				if (!scope) {
					this.view.set('no-employee');
					return;
				}
				this.load();
			});
	}

	/** The signed-in employee in the selected organization; null while the user is not an employee here. */
	private scopes(): Observable<IInboxNotificationSettingScope | null> {
		return combineLatest([this.store.user$, this.store.selectedOrganization$]).pipe(
			filter(([user, organization]) => !!user && !!organization),
			map(([user, organization]) => {
				const employeeId = (user?.employee?.id ?? user?.employeeId ?? null) as ID | null;
				const tenantId = (organization?.tenantId ?? user?.tenantId) as ID;
				return employeeId ? { tenantId, organizationId: organization!.id as ID, employeeId } : null;
			}),
			distinctUntilChanged((a, b) => a?.employeeId === b?.employeeId && a?.organizationId === b?.organizationId)
		);
	}

	load(): void {
		const scope = this.scope;
		if (!scope) return;
		this.view.set('loading');
		this.api
			.forEmployee(scope)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (setting) => {
					this.setting.set(setting);
					this.view.set('ready');
				},
				error: (error) => this.view.set(viewOfLoadError(error) === 'unavailable' ? 'error' : viewOfLoadError(error))
			});
	}

	isOn(key: NotificationSettingKey): boolean {
		return isKindOn(this.setting(), key);
	}

	modeOf(type: EmployeeNotificationTypeEnum): EmployeeNotificationEmailMode {
		return emailModeOf(this.preferences(), type);
	}

	/** A kind's own choice, or `default`: it follows the mode of every kind. */
	ownModeOf(type: EmployeeNotificationTypeEnum): EmployeeNotificationEmailMode | 'default' {
		return ownEmailModeOf(this.preferences(), type) ?? 'default';
	}

	hourLabel(hour: number): string {
		return hourLabelOf(hour, this.translate.currentLang);
	}

	setKind(key: NotificationSettingKey, isOn: boolean): void {
		this.save(key, { [key]: isOn }, (row) => ({ ...row, [key]: isOn }));
	}

	setKindMode(type: EmployeeNotificationTypeEnum, mode: EmployeeNotificationEmailMode | 'default'): void {
		if (mode === this.ownModeOf(type)) return;
		// `default` takes the kind's own choice away, so it follows the mode of every kind again.
		this.savePreferences({ emailByType: { [type]: mode === 'default' ? undefined : mode } });
	}

	setDefaultMode(mode: EmployeeNotificationEmailMode): void {
		if (mode === this.defaultMode()) return;
		this.savePreferences({ email: mode });
	}

	toggleQuietHours(isOn: boolean): void {
		if (isOn === !!this.quietHours()) return;
		this.savePreferences({ dnd: isOn ? { ...DEFAULT_QUIET_HOURS, timeZone: browserTimeZone() } : null });
	}

	setQuietHour(part: 'start' | 'end', event: Event): void {
		const value = String((event.target as HTMLInputElement | null)?.value ?? '').trim();
		const window = this.quietHours();
		if (!window || !isTimeOfDay(value) || window[part] === value) return;
		this.savePreferences({ dnd: { ...window, [part]: value } });
	}

	setDigestHour(hour: number): void {
		if (hour === this.digestHour()) return;
		this.savePreferences({ digestHour: hour });
	}

	private savePreferences(patch: Partial<IEmployeeNotificationPreferences>): void {
		const next = withPreferencePatch(this.preferences(), patch);
		this.save('preferences', { preferences: next }, (row) => ({ ...row, preferences: next }));
	}

	/**
	 * Saves one change: the row updated optimistically where it exists (a first change creates it, and waits), the
	 * API's answer kept, the row put back and the refusal shown when the API said no. One save of a kind at a time.
	 */
	private save(
		busyKey: string,
		input: IInboxNotificationSettingInput,
		apply: (row: IEmployeeNotificationSetting) => IEmployeeNotificationSetting
	): void {
		const scope = this.scope;
		if (!scope || this.busy().has(busyKey)) return;
		const before = this.setting();
		// Without a row every save is a POST: a second one before the first answers would create a second row.
		if (!before?.id && this.busy().size > 0) return;
		this.busy.update((keys) => new Set(keys).add(busyKey));
		if (before?.id) this.setting.set(apply(before));
		const request = before?.id ? this.api.update(before.id as ID, scope, input) : this.api.create(scope, input);
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (saved) => {
				this.setting.set(saved);
				this.release(busyKey);
			},
			error: (error) => {
				this.setting.set(before);
				this.release(busyKey);
				this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant('INBOX.NOTIFICATION_SETTINGS.SAVE_FAILED'));
			}
		});
	}

	private release(busyKey: string): void {
		this.busy.update((keys) => {
			const next = new Set(keys);
			next.delete(busyKey);
			return next;
		});
	}
}
