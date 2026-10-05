import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubViewComponent } from './view.component';
import { IntegrationGithubUiModule } from '../../integration-github-ui.module';
import { PipesModule } from '@gauzy/ui-core/shared';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
describe('GithubViewComponent', () => {
	let component: GithubViewComponent;
	let fixture: ComponentFixture<GithubViewComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it. PipesModule provides the pipes it injects
			// (the app gets them from its root imports).
			imports: [IntegrationGithubUiModule, PipesModule],
			providers: [
				{
					provide: ActivatedRoute,
					// A child of the GitHub layout route (integration-github.routes.ts): the parent resolves the
					// integration tenant, and the child path carries `:integrationId`.
					useValue: {
						parent: { data: of({ integration: { id: 'integration-1', name: 'Github' } }) },
						snapshot: {
							data: { selectors: false },
							params: { integrationId: 'integration-1' },
							queryParams: {}
						},
						data: of({ selectors: false }),
						params: of({ integrationId: 'integration-1' }),
						queryParams: of({})
					}
				}
			],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(GithubViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
