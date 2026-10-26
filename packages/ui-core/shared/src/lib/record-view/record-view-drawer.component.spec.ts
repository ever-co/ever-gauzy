import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { RecordViewDrawerComponent } from './record-view-drawer.component';

@Component({
	template: `<ngx-record-view-drawer
		[open]="true"
		heading="TASKS_PAGE.HEADER"
		[fullViewLink]="link"
	></ngx-record-view-drawer>`,
	standalone: false
})
class HostComponent {
	link: string | null = null;
}

/**
 * The drawer is the quick look; a record with a page of its own gets a small "expand to full width" icon
 * in the drawer header that opens that page (owner, 2026-10-13, handover §4.P).
 */
describe('RecordViewDrawerComponent — expand to full width', () => {
	let fixture: ComponentFixture<HostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RouterLink],
			declarations: [HostComponent, RecordViewDrawerComponent],
			// nbButton / nbTooltip / nb-icon are Nebular's; only the link itself is under test.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(HostComponent);
	});

	const expandLink = () => fixture.debugElement.query(By.css('a.record-drawer-expand'));

	it('shows no expand icon for a record without a page of its own', () => {
		fixture.detectChanges();

		expect(expandLink()).toBeNull();
	});

	it('links the expand icon to the record page, as a real (bookmarkable, middle-clickable) link', () => {
		fixture.componentInstance.link = '/pages/tasks/view/aaaaaaaa-1111-4111-8111-111111111111';
		fixture.detectChanges();

		const link = expandLink();
		expect(link).not.toBeNull();
		expect(link.nativeElement.getAttribute('href')).toBe('/pages/tasks/view/aaaaaaaa-1111-4111-8111-111111111111');
		expect(link.nativeElement.getAttribute('aria-label')).toBe('BUTTONS.EXPAND_FULL_WIDTH');
	});

	it('keeps the close button next to it', () => {
		fixture.componentInstance.link = '/pages/tasks/view/x';
		fixture.detectChanges();

		expect(fixture.debugElement.query(By.css('.record-drawer-actions button.record-drawer-close'))).not.toBeNull();
	});
});
