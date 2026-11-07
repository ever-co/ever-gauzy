import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NbToggleModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { InboxWebPushService, InboxWebPushState } from '../services/inbox-web-push.service';

/**
 * Settings -> Notifications -> Browser notifications: the inbox's web push on this device. Shown where the platform
 * has web push on; the switch subscribes this browser (asking for permission) or removes it. A blocked or
 * unsupported browser says so, with the switch held.
 */
@Component({
	selector: 'ngx-inbox-browser-push',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbToggleModule, TranslatePipe],
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
						<nb-toggle
							data-test="browser-push-switch"
							[checked]="state() === 'on'"
							[disabled]="busy() || (state() !== 'on' && state() !== 'off')"
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

	/** Null while the first answer is on its way. */
	readonly state = signal<InboxWebPushState | null>(null);
	readonly busy = signal(false);

	ngOnInit(): void {
		void this.push.state().then((state) => this.state.set(state)).catch(() => this.state.set('unavailable'));
	}

	async toggle(isOn: boolean): Promise<void> {
		this.busy.set(true);
		try {
			this.state.set(isOn ? await this.push.enable() : await this.push.disable());
		} catch {
			this.toastr.danger(this.translate.instant('INBOX.NOTIFICATION_SETTINGS.PUSH_FAILED'));
			this.state.set(await this.push.state().catch(() => 'off' as const));
		} finally {
			this.busy.set(false);
		}
	}
}
