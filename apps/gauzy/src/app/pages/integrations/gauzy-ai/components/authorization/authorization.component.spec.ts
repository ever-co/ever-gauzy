import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GauzyAIAuthorizationComponent } from './authorization.component';

describe('GauzyAIAuthorizationComponent', () => {
	let component: GauzyAIAuthorizationComponent;
	let fixture: ComponentFixture<GauzyAIAuthorizationComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GauzyAIAuthorizationComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GauzyAIAuthorizationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
