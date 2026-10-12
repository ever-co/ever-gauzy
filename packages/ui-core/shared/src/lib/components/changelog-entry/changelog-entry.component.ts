import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { IChangelog } from '@gauzy/contracts';

/**
 * One "What's New" card. Shared by the changelog sidebar and the login page
 * panel so the two surfaces cannot drift apart. Entries carrying a
 * learnMoreUrl render as whole-card links opening in a new tab; without one
 * the anchor has no href, so it stays inert (not focusable, not clickable).
 *
 * Spacing between cards is the parent's concern (see `@shared/_whats-new`):
 * the host only sizes itself, so the login panel and the sidebar can keep
 * their different bottom margins.
 */
@Component({
	selector: 'ngx-changelog-entry',
	standalone: true,
	imports: [CommonModule, NbIconModule, TranslateModule],
	templateUrl: './changelog-entry.component.html',
	styleUrls: ['./changelog-entry.component.scss']
})
export class ChangelogEntryComponent {
	@Input({ required: true }) entry!: IChangelog;
}
