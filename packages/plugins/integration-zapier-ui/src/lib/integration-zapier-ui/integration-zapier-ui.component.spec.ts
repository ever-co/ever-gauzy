import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationZapierUiComponent } from './integration-zapier-ui.component';

describe('IntegrationZapierUiComponent', () => {
	let component: IntegrationZapierUiComponent;
	let fixture: ComponentFixture<IntegrationZapierUiComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntegrationZapierUiComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(IntegrationZapierUiComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
