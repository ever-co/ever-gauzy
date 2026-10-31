import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule, DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
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

	/** The card's date for an entry dated `date`, for a reader whose dates default to the `timezone` offset. */
	const shownDate = (date: string, timezone: string): string => {
		TestBed.configureTestingModule({ providers: [{ provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone } }] });
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

	// Entries are dated at midnight UTC. Read in the reader's time zone, midnight would be the day before west of
	// UTC, and a late hour the day after east of it.
	it.each([
		['2026-10-31T00:00:00.000Z', '-0800'],
		['2026-10-31T23:30:00.000Z', '+0900']
	])('shows the UTC day of an entry dated %s to a reader at %s', (date, timezone) => {
		expect(shownDate(date, timezone)).toBe('Oct 31, 2026');
	});
});
