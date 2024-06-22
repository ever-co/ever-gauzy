import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { i4netAIAuthorizationComponent } from './authorization.component';

describe('i4netAIAuthorizationComponent', () => {
	let component: i4netAIAuthorizationComponent;
	let fixture: ComponentFixture<i4netAIAuthorizationComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [i4netAIAuthorizationComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(i4netAIAuthorizationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
