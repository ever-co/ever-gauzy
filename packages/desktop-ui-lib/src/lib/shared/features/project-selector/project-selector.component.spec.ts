import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectSelectorComponent } from './project-selector.component';
describe('ProjectSelectorComponent', () => {
	let component: ProjectSelectorComponent;
	let fixture: ComponentFixture<ProjectSelectorComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ProjectSelectorComponent]
		});
		fixture = TestBed.createComponent(ProjectSelectorComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
