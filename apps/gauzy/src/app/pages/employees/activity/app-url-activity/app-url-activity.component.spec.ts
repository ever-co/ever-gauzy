import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AppUrlActivityComponent } from './app-url-activity.component';

describe('AppUrlActivityComponent', () => {
	let component: AppUrlActivityComponent;
	let fixture: ComponentFixture<AppUrlActivityComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [AppUrlActivityComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(AppUrlActivityComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
