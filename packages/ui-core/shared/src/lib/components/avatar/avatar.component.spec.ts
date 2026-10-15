import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IEmployee } from '@gauzy/contracts';
import { AvatarComponent } from './avatar.component';
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

	it('shows no badge for a person', () => {
		component.name = 'Jane Doe';
		component.employee = { kind: 'human' } as IEmployee;
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.agent-badge')).toBeNull();
	});
});
