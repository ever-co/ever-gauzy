import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationMakeComUiComponent } from './integration-make-com-ui.component';

describe('IntegrationMakeComUiComponent', () => {
	let component: IntegrationMakeComUiComponent;
	let fixture: ComponentFixture<IntegrationMakeComUiComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntegrationMakeComUiComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(IntegrationMakeComUiComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
