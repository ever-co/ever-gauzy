import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { NbButtonModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { InboxWebPushService, InboxWebPushState } from '../services/inbox-web-push.service';

/**
 * Settings -> Notifications -> Browser notifications: the inbox's web push on this device. Shown where the platform
 * has web push on; the switch subscribes this browser (asking for permission) or removes it. A blocked or
 * unsupported browser says so, with the switch held. A subscription the platform did not confirm (`sync-failed`) says
 * so too, with the switch on (switching off removes it) and a retry.
 */
@Component({
	selector: 'ngx-inbox-browser-push',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbToggleModule, TranslatePipe],
	// The settings page's row layout, for this section's own rows.
	styles: [
		`
			.group {
				margin-bottom: 1.5rem;
			}
			.group h5 {
				margin: 0 0 0.25rem;
			}
			.hint {
				margin: 0.25rem 0 0;
				font-size: 0.85rem;
				opacity: 0.75;
			}
			.row {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 1rem;
				padding: 0.75rem 0;
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
				justify-content: flex-end;
				align-items: center;
				gap: 0.75rem;
			}
		`
	],
	template: `
		@if (state() !== 'unavailable' && state() !== null) {
			<section class="group" data-test="browser-push">
				<h5>{{ 'INBOX.NOTIFICATION_SETTINGS.PUSH_TITLE' | translate }}</h5>
				<p class="hint">{{ 'INBOX.NOTIFICATION_SETTINGS.PUSH_HINT' | translate }}</p>
				<div class="row">
					<div class="text">
						<span class="label">{{ 'INBOX.NOTIFICATION_SETTINGS.PUSH_LABEL' | translate }}</span>
						<span class="hint" data-test="browser-push-state">{{ 'INBOX.NOTIFICATION_SETTINGS.PUSH_STATE.' + state() | translate }}</span>
					</div>
					<div class="controls">
						@if (state() === 'sync-failed') {
							<button nbButton size="small" type="button" data-test="browser-push-retry" [disabled]="busy()" (click)="retry()">
								{{ 'INBOX.RETRY' | translate }}
							</button>
						}
						<nb-toggle
							data-test="browser-push-switch"
							[checked]="checked()"
							[disabled]="busy() || (state() !== 'on' && state() !== 'off' && state() !== 'sync-failed')"
							[attr.aria-label]="'INBOX.NOTIFICATION_SETTINGS.PUSH_LABEL' | translate"
							(checkedChange)="toggle($event)"
						></nb-toggle>
					</div>
				</div>
			</section>
		}
	`
})
export class InboxBrowserPushComponent implements OnInit {
	private readonly push = inject(InboxWebPushService);
	private readonly toastr = inject(ToastrService);
	private readonly translate = inject(TranslateService);
	private readonly changeDetector = inject(ChangeDetectorRef);

	/** Null while the first answer is on its way. */
	readonly state = signal<InboxWebPushState | null>(null);
	readonly busy = signal(false);
	/**
	 * What the switch shows. `nb-toggle` moves before it emits: this follows it at once, then the outcome, so a refused
	 * or failed change moves the switch back.
	 */
	readonly checked = signal(false);

	/** Reads where this browser stands; a failure hides the section, as where web push is off. */
	ngOnInit(): void {
		void this.push
			.state()
			.then((state) => this.show(state))
			.catch(() => this.show('unavailable'));
	}

	/** The switch moved: switches this browser on or off, and shows the outcome (a failure is told). */
	async toggle(isOn: boolean): Promise<void> {
		this.busy.set(true);
		// Rendered now, so the outcome below is a change of the binding even when it lands before the next check.
		this.checked.set(isOn);
		this.changeDetector.detectChanges();
		try {
			this.show(isOn ? await this.push.enable() : await this.push.disable());
		} catch {
			this.toastr.danger(this.translate.instant('INBOX.NOTIFICATION_SETTINGS.PUSH_FAILED'));
			this.show(await this.push.state().catch(() => 'off' as const));
		} finally {
			this.busy.set(false);
		}
	}

	/** `sync-failed`: asks the platform again (the state registers a subscribed browser again); a new failure is told. */
	async retry(): Promise<void> {
		this.busy.set(true);
		try {
			const state = await this.push.state();
			this.show(state);
			if (state === 'sync-failed') this.toastr.danger(this.translate.instant('INBOX.NOTIFICATION_SETTINGS.PUSH_RETRY_FAILED'));
		} catch {
			this.toastr.danger(this.translate.instant('INBOX.NOTIFICATION_SETTINGS.PUSH_RETRY_FAILED'));
		} finally {
			this.busy.set(false);
		}
	}

	/** Shows a state: its text, and the switch on for a subscribed browser (confirmed or not). */
	private show(state: InboxWebPushState): void {
		this.state.set(state);
		this.checked.set(state === 'on' || state === 'sync-failed');
	}
}
