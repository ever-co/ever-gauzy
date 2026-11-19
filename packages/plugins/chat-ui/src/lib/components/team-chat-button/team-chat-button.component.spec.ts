// The ui-core barrel boots half the app (and needs packages this spec does not): what the button names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { ChatAvailabilityService } from '../../services/chat-availability.service';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatTeamDetails, ChatUiService } from '../../services/chat-ui.service';
import { TeamChatButtonComponent } from './team-chat-button.component';

const TEAM: ChatTeamDetails = { id: 't-web', name: 'Web Team', public: false, imageUrl: null, memberEmployeeIds: ['e-anna'] };

describe('TeamChatButtonComponent', () => {
	let fixture: ComponentFixture<TeamChatButtonComponent>;
	let answer: Subject<ChatTeamDetails | null>;
	let organization$: BehaviorSubject<{ id: string; tenantId: string } | null>;
	let user$: BehaviorSubject<{ id: string } | null>;
	let dock: { openTeam: jest.Mock };
	let api: { team: jest.Mock };
	let toastr: { danger: jest.Mock };
	const button = () => fixture.nativeElement.querySelector('[data-test="team-chat"]') as HTMLButtonElement;

	beforeEach(async () => {
		answer = new Subject();
		organization$ = new BehaviorSubject<{ id: string; tenantId: string } | null>({ id: 'org-1', tenantId: 'ten-1' });
		user$ = new BehaviorSubject<{ id: string } | null>({ id: 'u-1' });
		dock = { openTeam: jest.fn(() => Promise.resolve()) };
		api = { team: jest.fn(() => answer) };
		toastr = { danger: jest.fn() };
		await TestBed.configureTestingModule({
			imports: [TeamChatButtonComponent],
			providers: [
				{ provide: Store, useValue: { user$, selectedOrganization$: organization$ } },
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 't-web' })) } },
				{ provide: ChatDockService, useValue: dock },
				{ provide: ChatUiService, useValue: api },
				{ provide: ChatAvailabilityService, useValue: { available$: of(true) } },
				{ provide: ToastrService, useValue: toastr }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(TeamChatButtonComponent);
		fixture.detectChanges();
	});

	it("reads the page's team in the selected organization and opens its channel", () => {
		button().click();
		expect(api.team).toHaveBeenCalledWith('t-web', 'org-1', 'ten-1');
		answer.next(TEAM);
		expect(dock.openTeam).toHaveBeenCalledWith(TEAM);
	});

	it('opens nothing once the button is gone (the page left): the read is cancelled', () => {
		button().click();
		fixture.destroy();
		expect(answer.observed).toBe(false);
		answer.next(TEAM);
		expect(dock.openTeam).not.toHaveBeenCalled();
	});

	it('opens nothing when the organization or the user changed while the team was read', () => {
		button().click();
		organization$.next({ id: 'org-2', tenantId: 'ten-1' });
		answer.next(TEAM);
		expect(dock.openTeam).not.toHaveBeenCalled();

		organization$.next({ id: 'org-1', tenantId: 'ten-1' });
		answer = new Subject();
		api.team.mockReturnValue(answer);
		fixture.detectChanges();
		button().click();
		user$.next({ id: 'u-2' });
		answer.next(TEAM);
		expect(dock.openTeam).not.toHaveBeenCalled();
	});

	it('says so when the team cannot be read', () => {
		button().click();
		answer.error({ status: 500 });
		expect(toastr.danger).toHaveBeenCalled();
		expect(dock.openTeam).not.toHaveBeenCalled();
	});
});
