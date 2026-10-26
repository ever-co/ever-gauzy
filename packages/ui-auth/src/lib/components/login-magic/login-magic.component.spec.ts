import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbAuthModule } from '@nebular/auth';
import { NgxLoginMagicComponent } from './login-magic.component';
import { NgxAuthModule } from '../../auth.module';
describe('NgxLoginMagicComponent', () => {
	let component: NgxLoginMagicComponent;
	let fixture: ComponentFixture<NgxLoginMagicComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Declared in NgxAuthModule (not standalone): import it for the template's real scope
			// (ngx-gauzy-logo, Nebular forms, ...). NbAuthService comes from NbAuthModule.forRoot(), which the
			// app's root module calls.
			imports: [NgxAuthModule, NbAuthModule.forRoot()]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(NgxLoginMagicComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
