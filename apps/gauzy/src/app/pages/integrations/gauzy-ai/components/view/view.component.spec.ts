import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { i4netAIViewComponent } from './view.component';

describe('i4netAIViewComponent', () => {
	let component: i4netAIViewComponent;
	let fixture: ComponentFixture<i4netAIViewComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [i4netAIViewComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(i4netAIViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
