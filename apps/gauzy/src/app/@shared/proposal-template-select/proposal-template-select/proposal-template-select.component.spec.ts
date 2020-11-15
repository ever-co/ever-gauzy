import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalTemplateSelectComponent } from './proposal-template-select.component';

describe('ProposalTemplateSelectComponent', () => {
	let component: ProposalTemplateSelectComponent;
	let fixture: ComponentFixture<ProposalTemplateSelectComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProposalTemplateSelectComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ProposalTemplateSelectComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
