import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalTemplateFormComponent } from './proposal-template-form.component';
import { JobProposalTemplateModule } from '../../job-proposal-template.module';
describe('ProposalTemplateFormComponent', () => {
	let component: ProposalTemplateFormComponent;
	let fixture: ComponentFixture<ProposalTemplateFormComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule for the template's real scope.
			imports: [JobProposalTemplateModule],
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
