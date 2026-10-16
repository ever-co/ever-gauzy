import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbDialogService,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgxPermissionsService } from 'ngx-permissions';
import { BehaviorSubject, of } from 'rxjs';
import {
	OrganizationStrategicStateEnum,
	OrganizationStrategicVisibilityScopeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	EmployeesService,
	ErrorHandlingService,
	GoalService,
	OrganizationTeamsService,
	Store,
	StrategicInitiativesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { InitiativesComponent } from './initiatives.component';
import { InitiativeMutationComponent } from './initiative-mutation/initiative-mutation.component';
import { InitiativeDetailComponent } from './initiative-detail/initiative-detail.component';
import { parseInitiativeSignals } from './initiative-signals';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1', name: 'Acme' } as any;
const TEAM = { id: 'team-1', name: 'Agents' } as any;
const INITIATIVE = {
	id: 'initiative-1',
	title: 'Let agents ship',
	intent: 'Every repo has an agent reviewer.',
	state: OrganizationStrategicStateEnum.ACTIVE,
	visibilityScope: OrganizationStrategicVisibilityScopeEnum.TEAM,
	stewardId: 'employee-1',
	organizationId: ORGANIZATION.id,
	tenantId: ORGANIZATION.tenantId,
	teamIds: [TEAM.id],
	teams: [TEAM],
	projects: [{ id: 'project-1', name: 'Gauzy' }],
	signals: JSON.stringify({ confidenceLevel: 'high', perceivedMomentum: 'accelerating', knownRisks: ['Budget'] })
} as any;

/**
 * Goals → Initiatives (G-P2-4): the three components compile against their templates and render what the
 * API answers — the list, the create/edit dialog and the detail page.
 */
describe('Strategic initiatives pages', () => {
	let initiatives: {
		getAll: jest.Mock;
		getById: jest.Mock;
		create: jest.Mock;
		update: jest.Mock;
		updateSignals: jest.Mock;
		delete: jest.Mock;
	};
	let dialogRef: { close: jest.Mock };
	let dialogService: { open: jest.Mock };
	let store: { selectedOrganization$: BehaviorSubject<any>; selectedOrganization: any };

	beforeEach(async () => {
		initiatives = {
			getAll: jest.fn().mockResolvedValue({ items: [INITIATIVE], total: 1 }),
			getById: jest.fn().mockResolvedValue(INITIATIVE),
			create: jest.fn().mockImplementation(async (input) => ({ id: 'initiative-2', ...input })),
			update: jest.fn().mockImplementation(async (id, input) => ({ id, ...input })),
			updateSignals: jest.fn().mockImplementation(async (id, signals) => ({ id, signals })),
			delete: jest.fn().mockResolvedValue({})
		};
		dialogRef = { close: jest.fn() };
		dialogService = { open: jest.fn(() => ({ onClose: of(null) })) };
		store = { selectedOrganization$: new BehaviorSubject(ORGANIZATION), selectedOrganization: ORGANIZATION };

		await TestBed.configureTestingModule({
			declarations: [InitiativesComponent, InitiativeMutationComponent, InitiativeDetailComponent],
			imports: [
				CommonModule,
				ReactiveFormsModule,
				RouterModule.forRoot([]),
				NbButtonModule,
				NbCardModule,
				NbIconModule,
				NbInputModule,
				NbSelectModule,
				NbSpinnerModule
			],
			providers: [
				{ provide: Store, useValue: store },
				{ provide: StrategicInitiativesService, useValue: initiatives },
				{
					provide: OrganizationTeamsService,
					useValue: { getAll: jest.fn().mockResolvedValue({ items: [TEAM], total: 1 }) }
				},
				{
					provide: EmployeesService,
					useValue: {
						getAll: jest
							.fn()
							.mockReturnValue(
								of({ items: [{ id: 'employee-1', user: { name: 'Ada Steward' } }], total: 1 })
							)
					}
				},
				{
					provide: GoalService,
					useValue: {
						getAllGoals: jest
							.fn()
							.mockResolvedValue({ items: [{ id: 'g-1', name: 'Ship v1', progress: 40 }] })
					}
				},
				{ provide: ToastrService, useValue: { success: jest.fn() } },
				{ provide: ErrorHandlingService, useValue: { handleError: jest.fn() } },
				{ provide: NbDialogService, useValue: dialogService },
				{ provide: NbDialogRef, useValue: dialogRef },
				{
					provide: ActivatedRoute,
					useValue: { paramMap: of(convertToParamMap({ id: INITIATIVE.id })), snapshot: {} }
				}
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();

		TestBed.inject(NgxPermissionsService).loadPermissions(
			[
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_CREATE,
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
			].map(String)
		);
	});

	const settle = async <T>(fixture: ComponentFixture<T>) => {
		fixture.detectChanges();
		await fixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve));
		fixture.detectChanges();
	};

	it('lists the initiatives of the selected organization, with their linked teams', async () => {
		const fixture = TestBed.createComponent(InitiativesComponent);
		await settle(fixture);

		expect(initiatives.getAll).toHaveBeenCalledWith(ORGANIZATION.id, ORGANIZATION.tenantId);
		const text: string = fixture.nativeElement.textContent;
		expect(text).toContain('Let agents ship');
		expect(text).toContain('Agents');
		expect(fixture.componentInstance.signals(INITIATIVE)).toMatchObject({ confidenceLevel: 'high' });
	});

	it('creates an initiative with its teams and signals', async () => {
		const fixture = TestBed.createComponent(InitiativeMutationComponent);
		fixture.componentInstance.organization = ORGANIZATION;
		await settle(fixture);

		fixture.componentInstance.form.patchValue({
			title: '  Agents everywhere ',
			teamIds: [TEAM.id],
			confidenceLevel: 'medium',
			knownRisks: 'Cost\n\nReview load '
		});
		await fixture.componentInstance.save();

		expect(initiatives.create).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Agents everywhere',
				teamIds: [TEAM.id],
				organizationId: ORGANIZATION.id,
				tenantId: ORGANIZATION.tenantId,
				signals: expect.objectContaining({ confidenceLevel: 'medium', knownRisks: ['Cost', 'Review load'] })
			})
		);
		expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'initiative-2' }));
	});

	it('edits an initiative: the fields, then the signals as one assessment', async () => {
		const fixture = TestBed.createComponent(InitiativeMutationComponent);
		fixture.componentInstance.organization = ORGANIZATION;
		fixture.componentInstance.initiative = INITIATIVE;
		await settle(fixture);

		expect(fixture.componentInstance.form.value).toMatchObject({ title: INITIATIVE.title, teamIds: [TEAM.id] });
		fixture.componentInstance.form.patchValue({ teamIds: [] });
		await fixture.componentInstance.save();

		expect(initiatives.update).toHaveBeenCalledWith(INITIATIVE.id, expect.objectContaining({ teamIds: [] }));
		expect(initiatives.updateSignals).toHaveBeenCalledWith(
			INITIATIVE.id,
			expect.objectContaining({ confidenceLevel: 'high', knownRisks: ['Budget'] })
		);
	});

	it('shows the detail of one initiative: intent, steward, teams, goals and projects', async () => {
		const fixture = TestBed.createComponent(InitiativeDetailComponent);
		await settle(fixture);

		expect(initiatives.getById).toHaveBeenCalledWith(INITIATIVE.id, ['projects', 'teams']);
		const text: string = fixture.nativeElement.textContent;
		expect(text).toContain('Every repo has an agent reviewer.');
		expect(text).toContain('Ada Steward');
		expect(text).toContain('Agents');
		expect(text).toContain('Ship v1');
		expect(text).toContain('Gauzy');
		expect(text).toContain('Budget');
	});

	it('opens the detail page from a keyboard-reachable title link', async () => {
		const fixture = TestBed.createComponent(InitiativesComponent);
		await settle(fixture);

		const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.link');
		expect(link.getAttribute('href')).toBe(`/pages/goals/initiatives/${INITIATIVE.id}`);
	});

	it('discards the answer of an earlier organization that arrives after the current one', async () => {
		const OTHER = { id: 'org-2', tenantId: 'tenant-1', name: 'Beta' } as any;
		let answerFirst: (value: unknown) => void;
		initiatives.getAll.mockImplementation((organizationId: string) =>
			organizationId === ORGANIZATION.id
				? new Promise((resolve) => (answerFirst = resolve))
				: Promise.resolve({ items: [{ ...INITIATIVE, id: 'initiative-b', title: 'Beta plan' }], total: 1 })
		);
		const fixture = TestBed.createComponent(InitiativesComponent);
		const component = fixture.componentInstance;

		component.organization = ORGANIZATION;
		const first = component.load();
		component.organization = OTHER;
		await component.load();
		answerFirst({ items: [INITIATIVE], total: 1 });
		await first;

		expect(component.initiatives.map((initiative) => initiative.title)).toEqual(['Beta plan']);
		expect(component.loading).toBe(false);
	});

	it('sends a cleared steward, confidence and momentum as null on an edit', async () => {
		const fixture = TestBed.createComponent(InitiativeMutationComponent);
		fixture.componentInstance.organization = ORGANIZATION;
		fixture.componentInstance.initiative = INITIATIVE;
		await settle(fixture);

		fixture.componentInstance.form.patchValue({ stewardId: null, confidenceLevel: null, perceivedMomentum: null });
		await fixture.componentInstance.save();

		expect(initiatives.update).toHaveBeenCalledWith(INITIATIVE.id, expect.objectContaining({ stewardId: null }));
		expect(initiatives.updateSignals).toHaveBeenCalledWith(
			INITIATIVE.id,
			expect.objectContaining({ confidenceLevel: null, perceivedMomentum: null })
		);
	});

	it('leaves unset signals and steward out on a create', async () => {
		const fixture = TestBed.createComponent(InitiativeMutationComponent);
		fixture.componentInstance.organization = ORGANIZATION;
		await settle(fixture);

		fixture.componentInstance.form.patchValue({ title: 'New', stewardId: null });
		await fixture.componentInstance.save();

		const [input] = initiatives.create.mock.calls[0];
		expect(input).not.toHaveProperty('stewardId');
		expect(input.signals).not.toHaveProperty('confidenceLevel');
		expect(input.signals).not.toHaveProperty('perceivedMomentum');
	});

	it("edits from the detail page in the initiative's organization, whichever one is selected", async () => {
		store.selectedOrganization = { id: 'org-2', tenantId: 'tenant-1', name: 'Beta' };
		const fixture = TestBed.createComponent(InitiativeDetailComponent);
		await settle(fixture);

		await fixture.componentInstance.edit();

		const [, { context }] = dialogService.open.mock.calls[0];
		expect(context.organization).toMatchObject({ id: ORGANIZATION.id, tenantId: ORGANIZATION.tenantId });
	});

	it('reads a malformed signals document as no signals', () => {
		expect(parseInitiativeSignals('{not json')).toEqual({});
		expect(parseInitiativeSignals(null)).toEqual({});
		expect(parseInitiativeSignals({ strategicNotes: 'n' })).toEqual({ strategicNotes: 'n' });
	});
});
