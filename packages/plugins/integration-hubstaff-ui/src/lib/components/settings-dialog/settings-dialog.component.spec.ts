import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsDialogComponent } from './settings-dialog.component';
import { IntegrationHubstaffModule } from '../../integration-hubstaff-ui.module';
describe('SettingsDialogComponent', () => {
	let component: SettingsDialogComponent;
	let fixture: ComponentFixture<SettingsDialogComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [IntegrationHubstaffModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(SettingsDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
