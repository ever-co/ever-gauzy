import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginUpdateComponent } from './plugin-update.component';
describe('PluginUpdateComponent', () => {
	let component: PluginUpdateComponent;
	let fixture: ComponentFixture<PluginUpdateComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginUpdateComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(PluginUpdateComponent);
		component = fixture.componentInstance;
		// A smart-table cell renderer: the table sets `rowData` before the first render.
		component.rowData = { updatedAt: new Date('2026-01-05T09:00:00.000Z') };
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
