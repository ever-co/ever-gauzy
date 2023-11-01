import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GauzyAIViewComponent } from './view.component';

describe('GauzyAIViewComponent', () => {
	let component: GauzyAIViewComponent;
	let fixture: ComponentFixture<GauzyAIViewComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GauzyAIViewComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GauzyAIViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
