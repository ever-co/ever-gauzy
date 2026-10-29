import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EverWorksMapping, EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksDirectionsComponent } from './ever-works-directions.component';

const MAPPING = {
	integrationTenantId: 'm1',
	directions: { members: 'suggest', agents: 'ew_to_gauzy', teams: 'both', works: 'link_only', tasks: 'gauzy_to_ew', inbox: 'not-a-direction' },
	syncUnlinkedProjectTasks: false
} as unknown as EverWorksMapping;

/** The settings page's use: the saved mapping comes back as the input. */
@Component({
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [EverWorksDirectionsComponent],
	template: `<ngx-ever-works-directions organizationId="org-1" [mapping]="mapping" (savedMapping)="mapping = $event" />`
})
class SettingsHostComponent {
	mapping: EverWorksMapping | null = MAPPING;
}

/** Entities and directions: each domain offers only its own directions; save sends the choice. */
describe('EverWorksDirectionsComponent', () => {
	const api = { updateMapping: jest.fn() };

	function render(mapping: EverWorksMapping = MAPPING) {
		TestBed.configureTestingModule({ imports: [EverWorksDirectionsComponent], providers: [{ provide: EverWorksUiService, useValue: api }] });
		const fixture = TestBed.createComponent(EverWorksDirectionsComponent);
		Object.assign(fixture.componentInstance, { organizationId: 'org-1', mapping });
		fixture.componentInstance.ngOnChanges();
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
	}

	beforeEach(() => jest.resetAllMocks());

	it('lists every domain with only the directions it allows; an unknown stored value falls back', () => {
		const { component, el } = render();
		const works = el.querySelector('[data-test="direction-works"]') as HTMLSelectElement;
		expect(works.options.length).toBe(2); // link only, off
		expect(component.directions['tasks']).toBe('gauzy_to_ew');
		// The inbox syncs both ways now (new mappings): an unknown stored value falls back to that.
		expect(component.directions['inbox']).toBe('both');
		expect((el.querySelector('[data-test="direction-inbox"]') as HTMLSelectElement).options.length).toBe(4);
		expect(component.syncUnlinkedProjectTasks).toBe(false);
	});

	it('keeps a stored one-way inbox direction (existing mappings)', () => {
		const { component } = render({ ...MAPPING, directions: { ...(MAPPING.directions as Record<string, string>), inbox: 'ew_to_gauzy' } } as EverWorksMapping);
		expect(component.directions['inbox']).toBe('ew_to_gauzy');
	});

	it('saves the Gauzy Inbox backfill switch with the directions', () => {
		const mapping = { ...MAPPING, directions: { ...(MAPPING.directions as Record<string, string>), inbox: 'both' }, backfillGauzyInbox: false } as EverWorksMapping;
		api.updateMapping.mockReturnValue(of({ ...mapping, backfillGauzyInbox: true }));
		const { component, fixture, el } = render(mapping);
		const box = el.querySelector('[data-test="backfill-gauzy-inbox"]');
		expect(box?.textContent).toContain('EVER_WORKS.DIRECTIONS.BACKFILL_GAUZY_INBOX');
		expect(component.backfillGauzyInbox).toBe(false);
		(box?.querySelector('input') as HTMLInputElement).click();
		fixture.detectChanges();
		expect(component.backfillGauzyInbox).toBe(true);
		// Both ways sends Gauzy items: no hint.
		expect(el.querySelector('[data-test="backfill-needs-direction"]')).toBeNull();
		component.save();
		expect(api.updateMapping).toHaveBeenCalledWith('org-1', 'm1', expect.objectContaining({ backfillGauzyInbox: true, directions: expect.objectContaining({ inbox: 'both' }) }));
	});

	it('says the backfill needs an inbox direction that sends Gauzy items', () => {
		const { component, fixture, el } = render({
			...MAPPING,
			directions: { ...(MAPPING.directions as Record<string, string>), inbox: 'ew_to_gauzy' },
			backfillGauzyInbox: true
		} as EverWorksMapping);
		expect(el.querySelector('[data-test="backfill-needs-direction"]')).not.toBeNull();
		const inbox = el.querySelector('[data-test="direction-inbox"]') as HTMLSelectElement;
		inbox.selectedIndex = 2; // both, ew_to_gauzy, gauzy_to_ew, off
		inbox.dispatchEvent(new Event('change'));
		fixture.detectChanges();
		expect(component.directions['inbox']).toBe('gauzy_to_ew');
		expect(el.querySelector('[data-test="backfill-needs-direction"]')).toBeNull();
	});

	it('an older API (no backfill switch on the mapping): no box, and the switch is never sent', () => {
		api.updateMapping.mockReturnValue(of(MAPPING));
		const { component, el } = render();
		expect(el.querySelector('[data-test="backfill-gauzy-inbox"]')).toBeNull();
		component.save();
		expect(api.updateMapping.mock.calls[0][2]).not.toHaveProperty('backfillGauzyInbox');
	});

	it('saves the directions and the unpaired-projects switch, and hands the saved mapping back', () => {
		const saved = { ...MAPPING, syncUnlinkedProjectTasks: true } as EverWorksMapping;
		api.updateMapping.mockReturnValue(of(saved));
		const { component } = render();
		const emitted = jest.fn();
		component.savedMapping.subscribe(emitted);
		component.directions['teams'] = 'ew_to_gauzy';
		component.syncUnlinkedProjectTasks = true;
		component.save();
		expect(api.updateMapping).toHaveBeenCalledWith('org-1', 'm1', expect.objectContaining({ syncUnlinkedProjectTasks: true, directions: expect.objectContaining({ teams: 'ew_to_gauzy', works: 'link_only' }) }));
		expect(emitted).toHaveBeenCalledWith(saved);
		expect(component.saved).toBe(true);
	});

	it('on the settings page, "Saved" stays shown once the saved mapping comes back as the input (review F100)', () => {
		const saved = { ...MAPPING, syncUnlinkedProjectTasks: true } as EverWorksMapping;
		api.updateMapping.mockReturnValue(of(saved));
		TestBed.configureTestingModule({ imports: [SettingsHostComponent], providers: [{ provide: EverWorksUiService, useValue: api }] });
		const fixture = TestBed.createComponent(SettingsHostComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		(el.querySelector('[data-test="save-directions"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.mapping).toBe(saved);
		expect(el.querySelector('[data-test="directions-saved"]')).not.toBeNull();
		// Another mapping object (a switch changed elsewhere) is not this save: the notice goes.
		fixture.componentInstance.mapping = { ...saved, isEnabled: false } as EverWorksMapping;
		fixture.detectChanges();
		expect(el.querySelector('[data-test="directions-saved"]')).toBeNull();
	});

	it('marks a domain whose record type sync setting is off as not synced, whatever its direction (OQ4)', () => {
		const { el } = render({
			...MAPPING,
			directions: { ...(MAPPING.directions as Record<string, string>), docs: 'off' },
			effectiveDirections: { ...(MAPPING.directions as Record<string, string>), teams: 'off', docs: 'off' }
		} as EverWorksMapping);
		expect(el.querySelector('[data-test="direction-off-teams"]')).not.toBeNull();
		// Off by its own direction: nothing to explain. Without `effectiveDirections` (an older API): no hint.
		expect(el.querySelector('[data-test="direction-off-docs"]')).toBeNull();
		expect(el.querySelector('[data-test="direction-off-tasks"]')).toBeNull();
	});

	it('shows no such hint for a mapping answered without effectiveDirections (an older API)', () => {
		expect(render().el.querySelector('[data-test^="direction-off-"]')).toBeNull();
	});

	it('shows the API refusal', () => {
		api.updateMapping.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'teams syncs both, ew_to_gauzy, gauzy_to_ew, off; not x.' } })));
		const { component, fixture, el } = render();
		component.save();
		fixture.detectChanges();
		expect(el.querySelector('[data-test="directions-error"]')?.textContent).toContain('teams syncs');
	});
});
