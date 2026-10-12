import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetupComponent } from './setup.component';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { FormsModule } from '@angular/forms';
import { LanguageSelectorComponent } from '../language/language-selector.component';
describe('SetupComponent', () => {
	let component: SetupComponent;
	let fixture: ComponentFixture<SetupComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SetupComponent],
			// The desktop apps provide this library's GAUZY_ENV token as the web environment plus their own
			// flags (apps/desktop/src/main.ts). The web environment is enough for a render.
			providers: [{ provide: GAUZY_ENV, useValue: environment }]
		})
			// LanguageSelectorComponent (rendered inside setup) binds `[(ngModel)]` on its nb-select but does
			// not import FormsModule, so the zone test env rejects the template. The binding is dead in the app
			// too (`[(selected)]` next to it does the work); giving the child FormsModule here keeps this spec
			// about SetupComponent. Tracked as a separate template fix.
			.overrideComponent(LanguageSelectorComponent, { add: { imports: [FormsModule] } })
			.compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(SetupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
