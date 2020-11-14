import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalTemplateComponent } from './proposal-template.component';

describe('ProposalTemplateComponent', () => {
	let component: ProposalTemplateComponent;
	let fixture: ComponentFixture<ProposalTemplateComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProposalTemplateComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ProposalTemplateComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
