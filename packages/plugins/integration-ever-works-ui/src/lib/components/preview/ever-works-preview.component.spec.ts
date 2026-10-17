import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { EverWorksSyncPreview, EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksPreviewComponent } from './ever-works-preview.component';

const PREVIEW: EverWorksSyncPreview = {
	integrationTenantId: 'm1',
	generatedAt: '2026-10-16T22:00:00.000Z',
	isEnabled: true,
	directions: {},
	phases: [
		{ phase: 'agents', domain: 'agents', direction: 'ew_to_gauzy', supported: true, note: null, everWorks: { total: 3, linked: 1, truncated: false }, gauzy: null, creates: { inGauzy: 2, inEverWorks: 0 }, toPair: null },
		{ phase: 'teams', domain: 'teams', direction: 'both', supported: true, note: 'unpaired records wait for their tab', everWorks: { total: 2, linked: 1, truncated: false }, gauzy: { total: 4, linked: 1 }, creates: { inGauzy: 0, inEverWorks: 0 }, toPair: { everWorks: 1, gauzy: 3 } },
		{ phase: 'goals', domain: 'goals', direction: 'both', supported: false, note: 'not synced by this version yet', everWorks: null, gauzy: null, creates: { inGauzy: 0, inEverWorks: 0 }, toPair: null }
	]
};

/** The dry run: per phase counts, creates and what is still to pair; unsupported phases say why. */
describe('EverWorksPreviewComponent', () => {
	const api = { preview: jest.fn() };

	function render() {
		TestBed.configureTestingModule({ imports: [EverWorksPreviewComponent], providers: [{ provide: EverWorksUiService, useValue: api }] });
		const fixture = TestBed.createComponent(EverWorksPreviewComponent);
		Object.assign(fixture.componentInstance, { organizationId: 'org-1', integrationTenantId: 'm1' });
		fixture.componentInstance.ngOnChanges();
		fixture.detectChanges();
		return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
	}

	beforeEach(() => jest.resetAllMocks());

	it('renders one row per phase with its counts', () => {
		api.preview.mockReturnValue(of(PREVIEW));
		const { el } = render();
		expect(api.preview).toHaveBeenCalledWith('org-1', 'm1');
		const agents = el.querySelector('[data-test="phase-agents"]') as HTMLElement;
		expect(agents.querySelector('[data-test="creates-in-gauzy"]')?.textContent?.trim()).toBe('2');
		const teams = el.querySelector('[data-test="phase-teams"]') as HTMLElement;
		expect(teams.querySelector('[data-test="to-pair"]')?.textContent?.trim()).toBe('1 / 3');
		const goals = el.querySelector('[data-test="phase-goals"]') as HTMLElement;
		expect(goals.classList).toContain('unsupported');
		expect(goals.querySelector('[data-test="not-supported"]')?.textContent).toContain('not synced by this version yet');
	});

	it('a refresh replaces the dry run; a late answer to an earlier request is dropped', () => {
		const first = new Subject<EverWorksSyncPreview>();
		api.preview.mockReturnValueOnce(first).mockReturnValueOnce(of(PREVIEW));
		const { component } = render();
		component.load();
		first.next({ ...PREVIEW, phases: [] });
		expect(component.preview?.phases.length).toBe(3);
	});
});
