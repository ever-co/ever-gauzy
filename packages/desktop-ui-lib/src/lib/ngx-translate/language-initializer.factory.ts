import { lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';

export function LanguageInitializerFactory(
	translate: TranslateService,
	electronService: ElectronService
) {
	return async () => {
		const language = await electronService.ipcRenderer.invoke(
			'PREFERRED_LANGUAGE'
		);
		translate.setDefaultLang(LanguagesEnum.ENGLISH);
		return lastValueFrom(translate.use(language || LanguagesEnum.ENGLISH));
	};
}
