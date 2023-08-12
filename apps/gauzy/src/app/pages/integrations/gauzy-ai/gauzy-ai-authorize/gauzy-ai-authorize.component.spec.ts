import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GauzyAIAuthorizeComponent } from './gauzy-ai-authorize.component';

describe('GauzyAIAuthorizeComponent', () => {
	let component: GauzyAIAuthorizeComponent;
	let fixture: ComponentFixture<GauzyAIAuthorizeComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GauzyAIAuthorizeComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GauzyAIAuthorizeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
