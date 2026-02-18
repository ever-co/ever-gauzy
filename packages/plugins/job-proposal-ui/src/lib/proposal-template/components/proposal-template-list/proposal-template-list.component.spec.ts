import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalTemplateListComponent } from './proposal-template-list.component';

describe('ProposalTemplateListComponent', () => {
	let component: ProposalTemplateListComponent;
	let fixture: ComponentFixture<ProposalTemplateListComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProposalTemplateListComponent],
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
