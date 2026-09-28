import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalTemplateFormComponent } from './proposal-template-form.component';
import { JobProposalTemplateModule } from '../../job-proposal-template.module';
import { EmployeesService } from '@gauzy/ui-core/core';
describe('ProposalTemplateFormComponent', () => {
	let component: ProposalTemplateFormComponent;
	let fixture: ComponentFixture<ProposalTemplateFormComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule for the template's real scope.
			imports: [JobProposalTemplateModule],
			// Provided by the host feature modules in the app.
			providers: [EmployeesService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(ProposalTemplateFormComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
