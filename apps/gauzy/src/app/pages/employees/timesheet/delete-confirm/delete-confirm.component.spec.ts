import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteConfirmComponent } from './delete-confirm.component';

describe('DeleteConfirmComponent', () => {
	let component: DeleteConfirmComponent;
	let fixture: ComponentFixture<DeleteConfirmComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [DeleteConfirmComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(DeleteConfirmComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
