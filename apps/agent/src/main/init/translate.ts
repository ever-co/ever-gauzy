import { TranslateLoader } from '@gauzy/desktop-lib';
import * as path from 'path';
/* Load translations */
export default function InitAppTranslation() {
	let i18nPath = path.join(__dirname, '../..', 'assets', 'i18n/');
	if (process.env.NODE_ENV === 'development') {
		i18nPath = path.join(process.cwd(), 'apps/agent/src/assets', 'i18n/');
	}
	TranslateLoader.load(i18nPath);
}
