import { TranslateLoader } from '@gauzy/desktop-lib';
import * as path from 'path';
/* Load translations */
export default function InitAppTranslation() {
	TranslateLoader.load(path.join(__dirname, '../..', 'assets', 'i18n/'));
}
