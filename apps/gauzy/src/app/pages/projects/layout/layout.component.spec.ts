import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectLayoutComponent } from './layout.component';

describe('ProjectLayoutComponent', () => {
	let component: ProjectLayoutComponent;
	let fixture: ComponentFixture<ProjectLayoutComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ProjectLayoutComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
