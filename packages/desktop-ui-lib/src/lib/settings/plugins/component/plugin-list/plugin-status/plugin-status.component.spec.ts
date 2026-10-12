import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginStatusComponent } from './plugin-status.component';
describe('PluginStatusComponent', () => {
	let component: PluginStatusComponent;
	let fixture: ComponentFixture<PluginStatusComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginStatusComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(PluginStatusComponent);
		component = fixture.componentInstance;
		// A smart-table cell renderer: the table sets `rowData` before the first render.
		component.rowData = { isActivate: true };
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
