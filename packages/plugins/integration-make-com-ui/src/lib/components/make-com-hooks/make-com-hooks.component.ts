import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComHook, IMakeComSetupStatus } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-hooks',
	templateUrl: './make-com-hooks.component.html',
	styleUrls: ['./make-com-hooks.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MakeComHooksComponent extends TranslationBaseComponent implements OnInit {
	public hooks: IMakeComHook[] = [];
	public loading = false;
	public actionLoading: Record<number, boolean> = {};
	public setupStatus: IMakeComSetupStatus | null = null;

	private readonly _makeComStoreService = inject(MakeComStoreService);
	private readonly _toastrService = inject(ToastrService);

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this._checkSetupAndLoad();
	}

	private _checkSetupAndLoad() {
		this.loading = true;
		this._makeComStoreService
			.loadSetupStatus()
			.pipe(
				tap((status) => {
					this.setupStatus = status;
					if (status.isComplete) {
						this._loadHooks();
					} else {
						this.loading = false;
					}
				}),
				catchError((error) => {
					this.setupStatus = null;
					this.loading = false;
					this._toastrService.error(
						error?.error?.message || 'Failed to load setup status',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadHooks() {
		this.loading = true;
		this._makeComStoreService
			.loadHooks()
			.pipe(
				tap((hooks) => (this.hooks = hooks)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to load webhooks',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	toggleHook(hook: IMakeComHook) {
		this.actionLoading[hook.id] = true;
		const action$ = hook.enabled
			? this._makeComStoreService.disableHook(hook.id)
			: this._makeComStoreService.enableHook(hook.id);

		action$
			.pipe(
				tap(() => {
					this._toastrService.success(
						hook.enabled ? 'Webhook disabled' : 'Webhook enabled',
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				switchMap(() => this._makeComStoreService.loadHooks()),
				tap((hooks) => (this.hooks = hooks)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to toggle webhook',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.actionLoading[hook.id] = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	pingHook(hook: IMakeComHook) {
		this.actionLoading[hook.id] = true;
		this._makeComStoreService
			.pingHook(hook.id)
			.pipe(
				tap(() => {
					this._toastrService.success(
						`Webhook "${hook.name}" pinged successfully`,
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to ping webhook',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.actionLoading[hook.id] = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	refresh() {
		this._checkSetupAndLoad();
	}
}
