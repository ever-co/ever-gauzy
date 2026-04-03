import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComScenario, IMakeComSetupStatus } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-scenarios',
	templateUrl: './make-com-scenarios.component.html',
	styleUrls: ['./make-com-scenarios.component.scss'],
	standalone: false
})
export class MakeComScenariosComponent extends TranslationBaseComponent implements OnInit {
	public scenarios: IMakeComScenario[] = [];
	public loading = false;
	public actionLoading: Record<number, boolean> = {};
	public setupStatus: IMakeComSetupStatus | null = null;

	public get setupMessageKey(): string | null {
		const status = this.setupStatus;
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
	}

	constructor(
		private readonly _makeComStoreService: MakeComStoreService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
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
						this._loadScenarios();
					} else {
						this.loading = false;
					}
				}),
				catchError((error) => {
					this.setupStatus = { hasAccessToken: false, zone: null, makeOrganizationId: null, makeTeamId: null, isComplete: false };
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadScenarios() {
		this.loading = true;
		this._makeComStoreService
			.loadScenarios()
			.pipe(
				tap((scenarios) => (this.scenarios = scenarios)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to load scenarios',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	toggleScenario(scenario: IMakeComScenario) {
		this.actionLoading[scenario.id] = true;
		const action$ = scenario.isEnabled
			? this._makeComStoreService.stopScenario(scenario.id)
			: this._makeComStoreService.startScenario(scenario.id);

		action$
			.pipe(
				tap(() => {
					this._toastrService.success(
						scenario.isEnabled ? 'Scenario deactivated' : 'Scenario activated',
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				switchMap(() => this._makeComStoreService.loadScenarios()),
				tap((scenarios) => (this.scenarios = scenarios)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to toggle scenario',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.actionLoading[scenario.id] = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	runScenario(scenario: IMakeComScenario) {
		this.actionLoading[scenario.id] = true;
		this._makeComStoreService
			.runScenario(scenario.id)
			.pipe(
				tap(() => {
					this._toastrService.success(
						`Scenario "${scenario.name}" executed`,
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || 'Failed to run scenario',
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.actionLoading[scenario.id] = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	refresh() {
		this._checkSetupAndLoad();
	}
}
