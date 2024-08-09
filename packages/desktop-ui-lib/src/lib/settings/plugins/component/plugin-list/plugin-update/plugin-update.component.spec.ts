import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginUpdateComponent } from './plugin-update.component';

describe('PluginUpdateComponent', () => {
	let component: PluginUpdateComponent;
	let fixture: ComponentFixture<PluginUpdateComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [PluginUpdateComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginUpdateComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
