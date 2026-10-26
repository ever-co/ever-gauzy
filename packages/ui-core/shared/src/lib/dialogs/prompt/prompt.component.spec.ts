import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PromptComponent } from './prompt.component';
import { DialogsModule } from '../dialogs.module';
describe('PromptComponent', () => {
	let component: PromptComponent;
	let fixture: ComponentFixture<PromptComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Declared in DialogsModule (not standalone): import it so the template gets that module's scope.
			imports: [DialogsModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(PromptComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
