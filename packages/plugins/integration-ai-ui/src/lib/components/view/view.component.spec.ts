import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationAIViewComponent } from './view.component';

describe('IntegrationAIViewComponent', () => {
	let component: IntegrationAIViewComponent;
	let fixture: ComponentFixture<IntegrationAIViewComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [IntegrationAIViewComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(IntegrationAIViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
