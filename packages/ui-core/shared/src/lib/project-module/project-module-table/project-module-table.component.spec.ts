import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectModuleTableComponent } from './project-module-table.component';

describe('ProjectModuleTableComponent', () => {
	let component: ProjectModuleTableComponent;
	let fixture: ComponentFixture<ProjectModuleTableComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ProjectModuleTableComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(ProjectModuleTableComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
