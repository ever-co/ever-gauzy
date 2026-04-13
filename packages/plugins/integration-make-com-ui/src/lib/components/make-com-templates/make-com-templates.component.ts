import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComTemplate, IMakeComSetupStatus } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { MakeComStoreService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-templates',
	templateUrl: './make-com-templates.component.html',
	styleUrls: ['./make-com-templates.component.scss'],
	standalone: false
})
export class MakeComTemplatesComponent extends TranslationBaseComponent implements OnInit {
	public templates: IMakeComTemplate[] = [];
	public loading = false;
	public setupStatus: IMakeComSetupStatus | null = null;

	public get setupMessageKey(): string | null {
		if (this.loading) return null;
		const s = this.setupStatus;
		if (!s || s.isComplete) return null;
		if (!s.hasAccessToken) return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.AUTHORIZE';
		if (!s.zone) return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.ZONE';
		if (!s.makeOrganizationId) return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.ORGANIZATION';
		if (!s.makeTeamId) return 'INTEGRATIONS.MAKE_COM_PAGE.SETUP_REQUIRED.TEAM';
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
		this.templates = [];
		this._makeComStoreService
			.loadSetupStatus()
			.pipe(
				tap((status) => {
					this.setupStatus = status;
					if (status.isComplete) {
						this._loadTemplates();
					} else {
						this.loading = false;
					}
				}),
				catchError((error) => {
					this.setupStatus = null;
					this.loading = false;
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

	private _loadTemplates() {
		this.loading = true;
		this._makeComStoreService
			.loadTemplates()
			.pipe(
				tap((templates) => (this.templates = templates)),
				catchError((error) => {
					this._toastrService.error(
						error?.error?.message || this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.LOAD_TEMPLATES'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => (this.loading = false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	refresh() {
		this._checkSetupAndLoad();
	}
}
