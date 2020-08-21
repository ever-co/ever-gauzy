import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PromptComponent } from './prompt.component';

describe('PromptComponent', () => {
	let component: PromptComponent;
	let fixture: ComponentFixture<PromptComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [PromptComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(PromptComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
