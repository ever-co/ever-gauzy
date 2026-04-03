import { Component, OnInit, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { IMakeComScenario, IMakeComSetupStatus } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-scenarios',
	templateUrl: './make-com-scenarios.component.html',
	styleUrls: ['./make-com-scenarios.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MakeComScenariosComponent extends TranslationBaseComponent implements OnInit {
	private readonly _makeComStoreService = inject(MakeComStoreService);
	private readonly _toastrService = inject(ToastrService);

	public scenarios = signal<IMakeComScenario[]>([]);
	public loading = signal(false);
	public actionLoading = signal<Record<number, boolean>>({});
	public setupStatus = signal<IMakeComSetupStatus | null>(null);

	public setupMessageKey = computed<string | null>(() => {
		const status = this.setupStatus();
		if (!status || status.isComplete) {
			return null;
		}

		if (!status.hasAccessToken) {
			return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.AUTHORIZE';
		}

		if (!status.zone) {
			return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.ZONE';
		}

		if (!status.makeOrganizationId) {
			return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.ORGANIZATION';
		}

		if (!status.makeTeamId) {
			return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.TEAM';
		}

		return null;
	});

	constructor() {
		super();
	}

	ngOnInit() {
		this._checkSetupAndLoad();
	}

	private _checkSetupAndLoad() {
		this.loading.set(true);
		this._makeComStoreService
			.loadSetupStatus()
			.pipe(
				tap((status) => {
					this.setupStatus.set(status);
					if (status.isComplete) {
						this._loadScenarios();
					} else {
						this.loading.set(false);
					}
				}),
				catchError((error) => {
					this.setupStatus.set(null);
					this.loading.set(false);
					this._toastrService.error(
						error?.error?.message || this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.LOAD_SETUP_STATUS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadScenarios() {
		this.loading.set(true);
		this._makeComStoreService
			.loadScenarios()
			.pipe(
				tap((scenarios) => this.scenarios.set(scenarios)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.LOAD_SCENARIOS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => this.loading.set(false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	toggleScenario(scenario: IMakeComScenario) {
		this.actionLoading.update((prev) => ({ ...prev, [scenario.id]: true }));
		const action$ = scenario.isEnabled
			? this._makeComStoreService.stopScenario(scenario.id)
			: this._makeComStoreService.startScenario(scenario.id);

		action$
			.pipe(
				tap(() => {
					this._toastrService.success(
						scenario.isEnabled
							? this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SUCCESS.SCENARIO_DEACTIVATED')
							: this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SUCCESS.SCENARIO_ACTIVATED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				switchMap(() => this._makeComStoreService.loadScenarios()),
				tap((scenarios) => this.scenarios.set(scenarios)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.TOGGLE_SCENARIO'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => this.actionLoading.update((prev) => ({ ...prev, [scenario.id]: false }))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	runScenario(scenario: IMakeComScenario) {
		this.actionLoading.update((prev) => ({ ...prev, [scenario.id]: true }));
		this._makeComStoreService
			.runScenario(scenario.id)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SUCCESS.SCENARIO_EXECUTED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.RUN_SCENARIO'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => this.actionLoading.update((prev) => ({ ...prev, [scenario.id]: false }))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	refresh() {
		this._checkSetupAndLoad();
	}
}
