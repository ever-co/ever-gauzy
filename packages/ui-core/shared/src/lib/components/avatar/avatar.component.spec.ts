import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { IEmployee, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { AvatarComponent, agentBadgeLabel } from './avatar.component';
describe('AvatarComponent', () => {
	let component: AvatarComponent;
	let fixture: ComponentFixture<AvatarComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AvatarComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(AvatarComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('marks an agent employee with a badge', () => {
		component.name = 'Ada Agent';
		component.employee = { kind: 'agent' } as IEmployee;
		fixture.detectChanges();
		const badge = fixture.nativeElement.querySelector('.agent-badge');
		expect(badge?.textContent?.trim()).toBe('Agent');
	});

	it('labels the badge with the translation once it is loaded, and Agent until then', () => {
		const translations = new Subject<string>();
		const labels: string[] = [];
		agentBadgeLabel({ stream: () => translations } as unknown as TranslateService).subscribe((label) =>
			labels.push(label)
		);

		translations.next('EMPLOYEES_PAGE.AGENT_BADGE'); // the file is not loaded yet: the key comes back
		translations.next('Agent·de');
		expect(labels).toEqual(['Agent', 'Agent·de']);
	});

	describe('linkTo="view"', () => {
		const OWN_ID = 'own-employee';
		const OTHER_ID = 'other-employee';
		let navigate: jest.SpyInstance;

		/** Signs in as an employee holding `permissions`. */
		const signInWith = (...permissions: PermissionsEnum[]) => {
			const store = TestBed.inject(Store);
			jest.spyOn(store, 'hasPermission').mockImplementation((permission) => permissions.includes(permission));
			jest.spyOn(store, 'user', 'get').mockReturnValue({ employee: { id: OWN_ID } } as IUser);
		};

		beforeEach(() => {
			navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
			component.linkTo = 'view';
		});

		it('opens the profile view for a user who can view employees', () => {
			signInWith(PermissionsEnum.ORG_EMPLOYEES_VIEW);
			component.edit(OTHER_ID);
			expect(navigate).toHaveBeenCalledWith([`/pages/employees/view/${OTHER_ID}`]);
		});

		it('opens their own edit form for an employee without ORG_EMPLOYEES_VIEW', () => {
			signInWith(PermissionsEnum.PROFILE_EDIT);
			component.edit(OWN_ID);
			expect(navigate).toHaveBeenCalledWith([`/pages/employees/edit/${OWN_ID}`]);
		});

		it("opens nothing for another employee's record without ORG_EMPLOYEES_VIEW", () => {
			signInWith(PermissionsEnum.PROFILE_EDIT);
			component.edit(OTHER_ID);
			expect(navigate).not.toHaveBeenCalled();
		});

		it('opens the edit form for a user who can edit employees but not view them', () => {
			signInWith(PermissionsEnum.ORG_EMPLOYEES_EDIT);
			component.edit(OTHER_ID);
			expect(navigate).toHaveBeenCalledWith([`/pages/employees/edit/${OTHER_ID}`]);
		});
	});

	it('shows no badge for a person', () => {
		component.name = 'Jane Doe';
		component.employee = { kind: 'human' } as IEmployee;
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.agent-badge')).toBeNull();
	});
});
