import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';
import { LanguageSelectorComponent } from '../language/language-selector.component';
import { ToastrNotificationService } from '../services/toastr-notification.service';
import { SetupComponent } from './setup.component';

/**
 * The "Server Hostname / IP Address" field of the setup screen (#7547-#7550). Only Gauzy Server and
 * Gauzy API Server (IS_SERVER) show it.
 */
describe('SetupComponent: server host', () => {
	let fixture: ComponentFixture<SetupComponent>;
	let component: SetupComponent;

	async function create(isServer: boolean): Promise<void> {
		await TestBed.configureTestingModule({
			imports: [SetupComponent],
			providers: [{ provide: GAUZY_ENV, useValue: { ...environment, IS_SERVER: isServer } }]
		})
			// See setup.component.spec.ts: the language selector needs FormsModule in the zone test env.
			.overrideComponent(LanguageSelectorComponent, { add: { imports: [FormsModule] } })
			.compileComponents();
		fixture = TestBed.createComponent(SetupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		// The integrated server with SQLite: every other field of the step is filled in by default.
		component.connectivityChange(null, 'integrated');
		component.databaseDriverChange(null, 'sqlite');
	}

	describe('Gauzy Server', () => {
		beforeEach(() => create(true));

		it('accepts the default host', () => {
			component.validation();

			expect(component.serverConfig.integrated.host).toBe('0.0.0.0');
			expect(component.buttonSave).toBe(true);
		});

		it.each(['999.1.1.1', 'bad host!'])('disables Save and Check for the invalid host %s (#7550)', (host) => {
			component.onIntegratedHostChange(host);

			expect(component.serverConfig.integrated.host).toBe(host);
			expect(component.buttonSave).toBe(false);
		});

		it.each([
			'192.168.1.20',
			'gauzy.example.com',
			'127.0.0.1',
			'localhost',
			'[fd00::20]',
			'https://gauzy.example.com:3000',
			''
		])('keeps Save enabled for %s', (host) => {
			component.onIntegratedHostChange(host);

			expect(component.buttonSave).toBe(true);
		});

		it('enables Save again once the host is fixed', () => {
			component.onIntegratedHostChange('999.1.1.1');
			component.onIntegratedHostChange('192.168.1.20');

			expect(component.buttonSave).toBe(true);
		});

		it('saves the host without the spaces around it', () => {
			component.onIntegratedHostChange('  192.168.1.20 ');

			expect(component.getServerConfig()).toEqual(expect.objectContaining({ host: '192.168.1.20' }));
		});

		describe('saving after the database check', () => {
			let send: jest.SpyInstance;
			let notifyError: jest.SpyInstance;

			const sent = (channel: string) =>
				send.mock.calls.filter(([name]) => name === channel).map(([, arg]) => arg);

			beforeEach(() => {
				const { ipcRenderer } = TestBed.inject(ElectronService);
				send = jest.spyOn(ipcRenderer, 'send');
				jest.spyOn(ipcRenderer, 'invoke').mockResolvedValue(undefined);
				notifyError = jest
					.spyOn(TestBed.inject(ToastrNotificationService), 'error')
					.mockImplementation(() => undefined);
			});

			// The IPC bridge of test-setup.ts is one global object: spies on it would keep earlier tests' calls.
			afterEach(() => jest.restoreAllMocks());

			it('checks the host again: one made invalid while the check ran is not saved', async () => {
				component.onIntegratedHostChange('192.168.1.20');
				component.saveChange();
				component.serverConfig.integrated.host = 'bad host!';

				await component.saveAndRun();

				expect(sent('start_server')).toEqual([]);
				expect(notifyError).toHaveBeenCalledWith('TIMER_TRACKER.SETTINGS.SERVER_HOST.INVALID');
				expect(component.isSaving).toBe(false);
				expect(component.buttonSave).toBe(false);
			});

			it('starts the server with a valid host', async () => {
				component.onIntegratedHostChange(' 192.168.1.20 ');
				component.saveChange();

				await component.saveAndRun();

				expect(sent('start_server')).toEqual([expect.objectContaining({ host: '192.168.1.20' })]);
				expect(notifyError).not.toHaveBeenCalled();
			});
		});
	});

	describe('apps without the host field', () => {
		beforeEach(() => create(false));

		it('do not check the hidden host', () => {
			component.serverConfig.integrated.host = 'bad host!';
			component.validation();

			expect(component.buttonSave).toBe(true);
		});
	});
});
