import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ViewTimeLogComponent } from './view-time-log.component';

describe('ViewTimeLogComponent', () => {
	let component: ViewTimeLogComponent;
	let fixture: ComponentFixture<ViewTimeLogComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ViewTimeLogComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ViewTimeLogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
