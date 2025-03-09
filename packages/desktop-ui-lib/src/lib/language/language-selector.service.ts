import { Injectable } from '@angular/core';
import { NbLayoutDirection, NbLayoutDirectionService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root',
})
export class LanguageSelectorService {
	private _osLanguage: string;
	constructor(
		private readonly _directionService: NbLayoutDirectionService,
		private readonly _electronService: ElectronService
	) {
		const locale = this._electronService.remote.app.getLocale();
		this._osLanguage =
			locale in LanguagesEnum ? locale : LanguagesEnum.ENGLISH;
	}

	public setLanguage(
		preferredLanguage: LanguagesEnum,
		translateService: TranslateService
	): void {
		if (
			preferredLanguage === LanguagesEnum.HEBREW ||
			preferredLanguage === LanguagesEnum.ARABIC
		) {
			this._directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this._directionService.setDirection(NbLayoutDirection.LTR);
		}
		translateService.use(preferredLanguage || this._osLanguage);
	}
}
