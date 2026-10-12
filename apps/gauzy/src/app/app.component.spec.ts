import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { CoreModule, LanguagesService } from '@gauzy/ui-core/core';
import { ComponentsModule } from '@gauzy/ui-core/shared';
import { AppComponent } from './app.component';
describe('AppComponent', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// AppModule is the root module (BrowserModule), so it cannot be imported here. This is what
			// it gives the root component: ui-core's CoreModule.forRoot() (analytics, SEO, Jitsu, auth),
			// the router outlet, the loading skeleton, and LanguagesService (ThemeModule's provider).
			declarations: [AppComponent],
			teardown: { destroyAfterEach: false },
			imports: [CoreModule.forRoot(), RouterModule, ComponentsModule],
			providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting(), LanguagesService]
		}).compileComponents();
	});
	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.debugElement.componentInstance;
		expect(app).toBeTruthy();
	});
});
