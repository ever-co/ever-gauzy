import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HubstaffComponent } from './hubstaff.component';
import { IntegrationHubstaffModule } from '../../integration-hubstaff-ui.module';
describe('HubstaffComponent', () => {
	let component: HubstaffComponent;
	let fixture: ComponentFixture<HubstaffComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [IntegrationHubstaffModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(HubstaffComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
