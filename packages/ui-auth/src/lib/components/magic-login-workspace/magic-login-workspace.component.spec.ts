import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbAuthModule } from '@nebular/auth';
import { NgxMagicSignInWorkspaceComponent } from './magic-login-workspace.component';
import { NgxAuthModule } from '../../auth.module';
describe('NgxMagicSignInWorkspaceComponent', () => {
	let component: NgxMagicSignInWorkspaceComponent;
	let fixture: ComponentFixture<NgxMagicSignInWorkspaceComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Declared in NgxAuthModule (not standalone): import it for the template's real scope and the
			// AuthService it provides. NbAuthModule.forRoot() is the app root module's call.
			imports: [NgxAuthModule, NbAuthModule.forRoot()]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(NgxMagicSignInWorkspaceComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
