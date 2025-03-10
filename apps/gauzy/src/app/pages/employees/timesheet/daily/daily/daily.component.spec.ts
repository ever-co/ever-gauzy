import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DailyComponent } from './daily.component';

describe('DailyComponent', () => {
	let component: DailyComponent;
	let fixture: ComponentFixture<DailyComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [DailyComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(DailyComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
