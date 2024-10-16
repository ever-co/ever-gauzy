import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationAIAuthorizationComponent } from './authorization.component';

describe('IntegrationAIAuthorizationComponent', () => {
	let component: IntegrationAIAuthorizationComponent;
	let fixture: ComponentFixture<IntegrationAIAuthorizationComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [IntegrationAIAuthorizationComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(IntegrationAIAuthorizationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
