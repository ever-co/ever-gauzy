import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectModuleTableComponent } from './project-module-table.component';
import { ProjectModuleTableModule } from './project-module-table.module';
describe('ProjectModuleTableComponent', () => {
	let component: ProjectModuleTableComponent;
	let fixture: ComponentFixture<ProjectModuleTableComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone (standalone: false), so it cannot be imported directly; import the NgModule that declares it.
			imports: [ProjectModuleTableModule]
		}).compileComponents();
		fixture = TestBed.createComponent(ProjectModuleTableComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
