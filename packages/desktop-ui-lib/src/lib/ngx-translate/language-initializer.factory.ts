import { from } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { ElectronService } from '../electron/services';

export function LanguageInitializerFactory(
	translate: TranslateService,
	electronService: ElectronService
) {
	return async () => {
		const languages = Object.values(LanguagesEnum);
		const language = await electronService.ipcRenderer.invoke(
			'PREFERRED_LANGUAGE'
		);
		translate.addLangs(languages);
		translate.setDefaultLang(language || LanguagesEnum.ENGLISH);
		return from(translate.use(language || LanguagesEnum.ENGLISH));
	};
}
