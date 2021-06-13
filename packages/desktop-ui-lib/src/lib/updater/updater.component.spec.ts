import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdaterComponent } from './updater.component';

describe('UpdaterComponent', () => {
	let component: UpdaterComponent;
	let fixture: ComponentFixture<UpdaterComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [UpdaterComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(UpdaterComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
