import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbButtonModule, NbCardModule, NbInputModule, NbSelectModule, NbSpinnerModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import {
	EmployeeNotificationEmailMode,
	EmployeeNotificationTypeEnum,
	ID,
	IEmployeeNotificationPreferences,
	IEmployeeNotificationSetting,
	IInboxDeliveryStatus
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import {
	IInboxNotificationSettingInput,
	IInboxNotificationSettingScope,
	InboxNotificationSettingsService
} from '../services/inbox-notification-settings.service';
import { apiErrorMessage, viewOfLoadError } from './inbox-settings.helpers';
import { InboxBrowserPushComponent } from './inbox-browser-push.component';
import {
	browserTimeZone,
	DEFAULT_QUIET_HOURS,
	defaultEmailModeOf,
	digestHourOf,
	emailDeliveryNoticeOf,
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
 * employee's own notification setting — one switch per kind, the email mode per kind (at once, in the daily digest,
 * never, or as every kind) and of every kind, the quiet hours (no email between two times, in the browser's time
 * zone) and the hour of the daily digest. One change saves at a time, every control held meanwhile; the row is
 * updated optimistically where it exists and comes back with the API's words when it refuses (a refused first save
 * reloads, so the controls show what is stored). A change of organization cancels what was loading, and an answer
 * from a scope that is no longer the page's is ignored. The delivery itself is the API's
 * (`GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED`); the preferences are kept either way, and the email section says so when
 * the server reports that no email can go out for the organization (`GET /inbox/delivery/status`).
 */
@Component({
	selector: 'ngx-inbox-notification-settings-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		TranslatePipe,
		InboxBrowserPushComponent
	],
	templateUrl: './notification-settings-page.component.html',
	styleUrl: './notification-settings-page.component.scss'
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
	/** Whether a save is on its way: one at a time, every control held meanwhile. */
	readonly saving = signal(false);
	readonly preferences = computed(() => preferencesOf(this.setting()));
	readonly defaultMode = computed(() => defaultEmailModeOf(this.preferences()));
	readonly quietHours = computed(() => quietHoursOf(this.preferences()));
	readonly digestHour = computed(() => digestHourOf(this.preferences()));
	readonly timeZone = computed(() => this.quietHours()?.timeZone || browserTimeZone());
	/** What the server says about delivery for the organization; null while unknown or unsaid. */
	readonly deliveryStatus = signal<IInboxDeliveryStatus | null>(null);
	readonly emailNotice = computed(() => emailDeliveryNoticeOf(this.deliveryStatus()));

	private scope: IInboxNotificationSettingScope | null = null;
	private loading?: Subscription;
	private loadingStatus?: Subscription;

	ngOnInit(): void {
		this.scopes()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((scope) => {
				// A load of the scope before is cancelled: its answer would be another organization's.
				this.loading?.unsubscribe();
				this.loadingStatus?.unsubscribe();
				this.scope = scope;
				this.setting.set(null);
				this.deliveryStatus.set(null);
				if (!scope) {
					this.view.set('no-employee');
					return;
				}
				this.load();
				this.loadDeliveryStatus(scope);
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
		this.loading?.unsubscribe();
		this.loading = this.api
			.forEmployee(scope)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (setting) => {
					if (this.scope !== scope) return;
					this.setting.set(setting);
					this.view.set('ready');
				},
				error: (error) => {
					if (this.scope !== scope) return;
					const view = viewOfLoadError(error);
					this.view.set(view === 'unavailable' ? 'error' : view);
				}
			});
	}

	/** The delivery status of the scope; an answer for a scope that is no longer the page's is ignored. */
	private loadDeliveryStatus(scope: IInboxNotificationSettingScope): void {
		this.loadingStatus = this.api
			.deliveryStatus()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((status) => {
				if (this.scope !== scope) return;
				this.deliveryStatus.set(status);
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
		return hourLabelOf(hour, this.translate.getCurrentLang());
	}

	setKind(key: NotificationSettingKey, isOn: boolean): void {
		if (isOn === this.isOn(key)) return;
		this.save({ [key]: isOn }, (row) => ({ ...row, [key]: isOn }));
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
		this.save({ preferences: next }, (row) => ({ ...row, preferences: next }));
	}

	/**
	 * Saves one change, one at a time (every control is held while one is on its way, so no second change can
	 * overlap it): the row updated optimistically where it exists, the API's answer kept, the row put back and the
	 * refusal shown when the API said no — and reloaded when there was no row yet, so the controls show what is
	 * stored rather than what was refused. An answer for a scope that is no longer the page's is ignored.
	 */
	private save(input: IInboxNotificationSettingInput, apply: (row: IEmployeeNotificationSetting) => IEmployeeNotificationSetting): void {
		const scope = this.scope;
		if (!scope || this.saving()) return;
		const before = this.setting();
		this.saving.set(true);
		if (before?.id) this.setting.set(apply(before));
		const request = before?.id ? this.api.update(before.id as ID, scope, input) : this.api.create(scope, input);
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (saved) => {
				this.saving.set(false);
				if (this.scope !== scope) return;
				this.setting.set(saved);
			},
			error: (error) => {
				this.saving.set(false);
				if (this.scope !== scope) return;
				if (before?.id) this.setting.set(before);
				else this.load();
				this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant('INBOX.NOTIFICATION_SETTINGS.SAVE_FAILED'));
			}
		});
	}
}
