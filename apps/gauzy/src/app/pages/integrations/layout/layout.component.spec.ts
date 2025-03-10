import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationLayoutComponent } from './layout.component';

describe('IntegrationLayoutComponent', () => {
	let component: IntegrationLayoutComponent;
	let fixture: ComponentFixture<IntegrationLayoutComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [IntegrationLayoutComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(IntegrationLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
