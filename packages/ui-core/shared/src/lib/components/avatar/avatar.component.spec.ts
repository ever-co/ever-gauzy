import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IEmployee } from '@gauzy/contracts';
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

	it('shows no badge for a person', () => {
		component.name = 'Jane Doe';
		component.employee = { kind: 'human' } as IEmployee;
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.agent-badge')).toBeNull();
	});
});
