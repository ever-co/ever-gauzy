import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from '@ngx-translate/core';
import { IChangelog } from '@gauzy/contracts';
import { ChangelogEntryComponent } from './changelog-entry.component';

/** A What's New card shows the day an entry is dated, wherever the reader is. */
describe('ChangelogEntryComponent', () => {
	beforeEach(() => {
		// The card's icon is drawn by Nebular, which needs its icon libraries: left out here.
		TestBed.overrideComponent(ChangelogEntryComponent, {
			set: { imports: [CommonModule, TranslatePipe], schemas: [CUSTOM_ELEMENTS_SCHEMA] }
		});
	});

	const shownDate = (date: string): string => {
		const fixture = TestBed.createComponent(ChangelogEntryComponent);
		fixture.componentRef.setInput('entry', {
			title: 'Dark mode',
			icon: 'moon-outline',
			content: 'Easier on the eyes.',
			date: new Date(date)
		} as IChangelog);
		fixture.detectChanges();
		return (fixture.nativeElement as HTMLElement).querySelector('.entry-header-date').textContent.trim();
	};

	// Entries are dated at midnight UTC. Read in local time, the first would be the day before west of UTC,
	// and the second the day after east of it.
	it.each(['2026-10-31T00:00:00.000Z', '2026-10-31T23:30:00.000Z'])(
		'shows the UTC day of an entry dated %s, whatever the time zone',
		(date) => {
			expect(shownDate(date)).toBe('Oct 31, 2026');
		}
	);
});
