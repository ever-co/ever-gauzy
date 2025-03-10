import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { WeeklyComponent } from './weekly.component';

describe('WeeklyComponent', () => {
	let component: WeeklyComponent;
	let fixture: ComponentFixture<WeeklyComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [WeeklyComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(WeeklyComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
