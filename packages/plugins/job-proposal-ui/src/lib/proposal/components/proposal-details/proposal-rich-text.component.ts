import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

/**
 * Shows a proposal's rich text (the proposal itself, or the job post it answers) inside the
 * proposal details page.
 *
 * The text is HTML written in the editor and set as this element's content, so the page's own
 * (emulated) styles cannot reach its paragraphs, lists and headings. Rather than `::ng-deep`, this
 * component's stylesheet is unencapsulated and every rule in it is scoped by this element's own
 * name plus the variant class the page sets on it (`pd-rich-text` for the job post,
 * `pd-sheet-text` for the proposal sheet), so the rules reach nothing else in the app.
 */
@Component({
	selector: 'ngx-proposal-rich-text',
	template: '',
	styleUrls: ['./proposal-rich-text.component.scss'],
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[innerHTML]': 'html()'
	}
})
export class ProposalRichTextComponent {
	/** The text to show, already marked safe by the page. */
	readonly html = input<SafeHtml | string>('');
}
