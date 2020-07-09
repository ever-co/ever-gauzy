import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectViewComponent } from './project-view.component';

describe('ProjectViewComponent', () => {
	let component: ProjectViewComponent;
	let fixture: ComponentFixture<ProjectViewComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ProjectViewComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ProjectViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
