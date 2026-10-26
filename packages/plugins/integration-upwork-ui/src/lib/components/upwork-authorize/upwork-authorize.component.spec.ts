import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpworkAuthorizeComponent } from './upwork-authorize.component';
import { IntegrationUpworkUiModule } from '../../integration-upwork-ui.module';
describe('UpworkAuthorizeComponent', () => {
	let component: UpworkAuthorizeComponent;
	let fixture: ComponentFixture<UpworkAuthorizeComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [IntegrationUpworkUiModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(UpworkAuthorizeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
