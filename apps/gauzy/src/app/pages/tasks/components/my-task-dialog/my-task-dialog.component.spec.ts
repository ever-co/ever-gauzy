import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyTaskDialogComponent } from './my-task-dialog.component';
import { TasksModule } from '../../tasks.module';
import { IOrganization, IUser } from '@gauzy/contracts';
import { EmployeesService, Store } from '@gauzy/ui-core/core';

/**
 * TasksModule imports DocumentLinksPanelComponent from the docs-ui plugin, and that package's entry
 * point also loads its PDF viewer, which resolves the pdf.js worker with `import.meta.url` — syntax
 * the CommonJS Jest runtime cannot parse, so this suite failed to load. The panel is docs-ui's own
 * (tested there); here a same-selector stand-in with the same inputs keeps the dialog's template whole.
 */
jest.mock('@gauzy/plugin-docs-ui', () => {
	const { Component } = jest.requireActual('@angular/core');
	class DocumentLinksPanelComponent {}
	Component({
		selector: 'gz-document-links-panel',
		template: '',
		inputs: ['entity', 'entityId', 'entityLabel', 'readonly', 'hideWhenEmpty']
	})(DocumentLinksPanelComponent);
	return { DocumentLinksPanelComponent };
});
describe('MyTaskDialogComponent', () => {
	let component: MyTaskDialogComponent;
	let fixture: ComponentFixture<MyTaskDialogComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. EmployeesService is provided by the host feature modules in the app.
			imports: [TasksModule],
			providers: [EmployeesService],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		// The dialog opens inside a signed-in session with an organization selected; it reads both on init
		// (an unguarded `selectedOrganization.id` in an async loader crashed the whole Jest worker).
		const store = TestBed.inject(Store);
		store.selectedOrganization = { id: 'organization-1', tenantId: 'tenant-1' } as IOrganization;
		store.user = { id: 'user-1', tenantId: 'tenant-1', employee: { id: 'employee-1' } } as IUser;
		fixture = TestBed.createComponent(MyTaskDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
