import { Component, OnInit } from '@angular/core';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierZapTemplate } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-zap-templates',
	templateUrl: './zapier-zap-templates.component.html',
	styleUrls: ['./zapier-zap-templates.component.scss'],
	standalone: false
})
export class ZapierZapTemplatesComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;

	/** List of Zap templates available from Zapier */
	public templates: IZapierZapTemplate[] = [];

	constructor(
		public readonly translateService: TranslateService,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadTemplates();
	}

	/**
	 * Loads publicly available Zap templates. No OAuth access token is
	 * required — the server attaches the configured Zapier client_id.
	 */
	private _loadTemplates(): void {
		this.loading = true;

		this._zapierService
			.getZapTemplates()
			.pipe(
				tap((templates: IZapierZapTemplate[]) => {
					this.templates = templates;
				}),
				catchError(() => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_ZAP_TEMPLATES'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
