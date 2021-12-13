import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEditProposalTemplateComponent } from './add-edit-proposal-template.component';

describe('AddEditProposalTemplateComponent', () => {
	let component: AddEditProposalTemplateComponent;
	let fixture: ComponentFixture<AddEditProposalTemplateComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AddEditProposalTemplateComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AddEditProposalTemplateComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
