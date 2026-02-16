import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalTemplateFormComponent } from './proposal-template-form.component';

describe('ProposalTemplateFormComponent', () => {
	let component: ProposalTemplateFormComponent;
	let fixture: ComponentFixture<ProposalTemplateFormComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProposalTemplateFormComponent],
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
