import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { CamshotViewerComponent } from './camshot-viewer.component';
describe('CamshotViewerComponent', () => {
	let component: CamshotViewerComponent;
	let fixture: ComponentFixture<CamshotViewerComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [CamshotViewerComponent],
			providers: [{ provide: NbDialogRef, useValue: { close: jest.fn() } }],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(CamshotViewerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
