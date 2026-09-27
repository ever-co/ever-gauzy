import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickActionsComponent } from './quick-actions.component';
import { DialogsModule } from '../dialogs.module';
import { TimeTrackerService } from '@gauzy/ui-core/core';
describe('QuickActionsComponent', () => {
	let component: QuickActionsComponent;
	let fixture: ComponentFixture<QuickActionsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Declared in DialogsModule (not standalone): import it so the template gets that module's scope. The real
			// TimeTrackerService starts a Web Worker, which jsdom lacks; the menu only reads `running`.
			imports: [DialogsModule],
			providers: [{ provide: TimeTrackerService, useValue: { running: false } }]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(QuickActionsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
