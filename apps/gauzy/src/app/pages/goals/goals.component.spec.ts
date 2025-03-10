import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { GoalsComponent } from './goals.component';

describe('GoalsComponent', () => {
	let component: GoalsComponent;
	let fixture: ComponentFixture<GoalsComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GoalsComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GoalsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
