import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Stands in for the wordmark in the translated label; never shown. */
const WORDMARK_MARK = '\u2063EVER_ID\u2063';

/** The label around the wordmark, e.g. `Login with` before it, or `Mit` before and `anmelden` after it. */
export interface IEverIdLoginLabelParts {
	before: string;
	after: string;
}

/**
 * Splits the translated `LOGIN_PAGE.LOGIN_WITH_EVER_ID` ("Login with {{ everId }}") at the wordmark, so every
 * language keeps its word order. A message without the placeholder (a missing translation) reads "Login with".
 *
 * @param text - The message, translated with the wordmark mark as `everId`.
 * @returns The words before and after the wordmark.
 */
export function everIdLoginLabelParts(text: string): IEverIdLoginLabelParts {
	const at = typeof text === 'string' ? text.indexOf(WORDMARK_MARK) : -1;
	if (at < 0) {
		return { before: 'Login with', after: '' };
	}
	return { before: text.slice(0, at).trim(), after: text.slice(at + WORDMARK_MARK.length).trim() };
}

let nextStarId = 0;

/**
 * The content of the "Login with Ever ID" button: the Ever star (the ever.works logo star, one turn every 9 s, still
 * with a reduced-motion setting), the words, and "Ever ID" as its wordmark ("ever" exactly as in the ever.works
 * wordmark). The same design as the Ever ID button of Ever Teams. The wordmark takes the text colour, so it follows
 * the light and dark themes; screen readers read "Login with Ever ID".
 *
 * The star and the wordmark are interim copies until the Ever brand kit (`ever-co/platform` packages/brand)
 * publishes the official files.
 */
@Component({
	selector: 'ngx-ever-id-login-label',
	standalone: true,
	imports: [AsyncPipe],
	templateUrl: './ever-id-login-label.component.html',
	styleUrls: ['./ever-id-login-label.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EverIdLoginLabelComponent {
	private readonly _translate = inject(TranslateService);

	/** One gradient per star: several stars on a page must not share an id. */
	public readonly gradientId = `ever-star-${++nextStarId}`;

	public readonly parts$: Observable<IEverIdLoginLabelParts> = this._translate
		.stream('LOGIN_PAGE.LOGIN_WITH_EVER_ID', { everId: WORDMARK_MARK })
		.pipe(map((text: string) => everIdLoginLabelParts(text)));
}
