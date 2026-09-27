import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalTemplateListComponent } from './proposal-template-list.component';
import { JobProposalTemplateModule } from '../../job-proposal-template.module';
import { PipesModule } from '@gauzy/ui-core/shared';
describe('ProposalTemplateListComponent', () => {
	let component: ProposalTemplateListComponent;
	let fixture: ComponentFixture<ProposalTemplateListComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. PipesModule provides the Nl2Br/Truncate pipes it injects (the app
			// gets them from its root imports).
			imports: [JobProposalTemplateModule, PipesModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(ProposalTemplateListComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
