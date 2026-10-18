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
		expect(component.directions['inbox']).toBe('ew_to_gauzy');
		expect(component.syncUnlinkedProjectTasks).toBe(false);
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

	it('shows the API refusal', () => {
		api.updateMapping.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'teams syncs both, ew_to_gauzy, gauzy_to_ew, off; not x.' } })));
		const { component, fixture, el } = render();
		component.save();
		fixture.detectChanges();
		expect(el.querySelector('[data-test="directions-error"]')?.textContent).toContain('teams syncs');
	});
});
