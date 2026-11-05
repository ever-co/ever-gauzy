import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { EMPTY, of } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import {
	ErrorHandlingService,
	NavigationService,
	OrganizationProjectStore,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { ProjectSelectorComponent } from './project.component';

/*
 * Rendered, unlike `project.component.spec.ts`: what is under test is the name the multi-select's button carries,
 * which nb-select gives none of its own and the selector sets on the rendered button.
 */
describe('ProjectSelectorComponent — the multi-select button is named', () => {
	const organization = { id: 'organization-1', tenantId: 'tenant-1' } as IOrganization;
	let fixture: ComponentFixture<ProjectSelectorComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProjectSelectorComponent],
			// The `translate` pipe and service come from the shared test defaults (jest.angular-defaults.ts).
			imports: [CommonModule, FormsModule, NgSelectModule, NbSelectModule],
			providers: [
				{
					provide: OrganizationProjectsService,
					useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }), getAllByEmployee: jest.fn() }
				},
				{
					provide: Store,
					useValue: {
						selectedOrganization$: of(organization),
						userRolePermissions$: of([]),
						hasAnyPermission: () => false
					}
				},
				{ provide: ToastrService, useValue: { success: jest.fn() } },
				{ provide: ErrorHandlingService, useValue: { handleError: jest.fn() } },
				{ provide: OrganizationProjectStore, useValue: { organizationProjectAction$: EMPTY, destroy: jest.fn() } },
				{ provide: NavigationService, useValue: { updateQueryParams: jest.fn() } },
				{ provide: ActivatedRoute, useValue: { queryParams: of({}) } }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(ProjectSelectorComponent);
		fixture.componentRef.setInput('showAllOption', false);
		fixture.componentRef.setInput('skipGlobalChange', true);
	});

	/** Draws the selector, then lets its after-render step label the button. */
	const render = async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};
	const button = (): HTMLButtonElement | null => fixture.nativeElement.querySelector('nb-select button.select-button');
	const labelText = () =>
		(fixture.nativeElement.querySelector(`#${fixture.componentInstance.multiSelectLabelId}`) as HTMLElement)
			?.textContent.trim();

	it('labels the button by the selector name, then by its own text', async () => {
		fixture.componentRef.setInput('multiple', true);
		fixture.componentRef.setInput('accessibleLabel', 'Projects');
		await render();

		const select = button();
		expect(select).not.toBeNull();
		expect(select.id).toBeTruthy();
		expect(select.getAttribute('aria-labelledby')).toBe(
			`${fixture.componentInstance.multiSelectLabelId} ${select.id}`
		);
		expect(labelText()).toBe('Projects');
		// The button's own text is the second part of its name: nothing picked yet, so the placeholder.
		expect(select.textContent).toContain('FORM.PLACEHOLDERS.ALL_PROJECTS');
	});

	it('falls back to the placeholder without a name or a label from the host', async () => {
		fixture.componentRef.setInput('multiple', true);
		fixture.componentRef.setInput('placeholder', 'Pick projects');
		await render();

		expect(labelText()).toBe('Pick projects');
	});

	it('names the button once the selector switches to multiple', async () => {
		await render();
		expect(button()).toBeNull();

		fixture.componentRef.setInput('multiple', true);
		await render();

		expect(button()?.getAttribute('aria-labelledby')).toContain(fixture.componentInstance.multiSelectLabelId);
	});
});
