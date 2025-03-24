import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
	beforeEach(() => {
		TestBed.configureTestingModule({
			declarations: [AppComponent],
			teardown: { destroyAfterEach: false },
			providers: [provideHttpClient(withInterceptorsFromDi())]
		}).compileComponents();
	});

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.debugElement.componentInstance;
		expect(app).toBeTruthy();
	});
});
