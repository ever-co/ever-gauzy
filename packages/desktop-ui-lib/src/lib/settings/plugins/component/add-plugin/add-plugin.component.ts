import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule, NbInputModule, NbToggleModule } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { DesktopDirectiveModule } from '../../../../directives/desktop-directive.module';
import { PluginInstallationQuery } from '../plugin-marketplace/+state';
import { PluginInstallationActions } from '../plugin-marketplace/+state/actions/plugin-installation.action';

type PluginContext = 'local' | 'cdn' | 'npm';

interface NpmModel {
	pkg: {
		name: string | null;
		version: string | null;
	};
	registry: {
		privateURL: string | null;
		authToken: string | null;
	};
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-add-plugin',
	templateUrl: './add-plugin.component.html',
	styleUrls: ['./add-plugin.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NbCardModule,
		NbButtonModule,
		DesktopDirectiveModule,
		NbIconModule,
		FormsModule,
		NbInputModule,
		NbToggleModule,
		AsyncPipe,
		TranslatePipe
	]
})
export class AddPluginComponent {
	private readonly dialogRef = inject(NbDialogRef<AddPluginComponent>);
	private readonly action = inject(Actions);
	protected readonly query = inject(PluginInstallationQuery);
	protected readonly error = signal<string | null>(null);
	protected readonly context = signal<PluginContext>('local');
	protected readonly showRegistry = signal<boolean>(false);
	protected readonly cdnUrl = signal<string>('');
	protected readonly npmModel = signal<NpmModel>({
		pkg: {
			name: null,
			version: null
		},
		registry: {
			privateURL: null,
			authToken: null
		}
	});

	protected readonly isLocalContext = computed(() => this.context() === 'local');
	protected readonly isCdnContext = computed(() => this.context() === 'cdn');
	protected readonly isNpmContext = computed(() => this.context() === 'npm');

	protected installPlugin(value: string): void {
		if (!value?.trim()) {
			this.error.set('TIMER_TRACKER.SETTINGS.PLUGIN_INSTALL_CDN_ERROR');
			return;
		}
		this.error.set(null);
		this.action.dispatch(PluginInstallationActions.install({ url: value.trim(), contextType: 'cdn' }));
	}

	protected localPluginInstall(): void {
		this.error.set(null);
		this.action.dispatch(PluginInstallationActions.install({ contextType: 'local' }));
	}

	protected updateRegistryAuthToken(authToken: string): void {
		this.npmModel.update((model) => ({
			...model,
			registry: { ...model.registry, authToken }
		}));
	}

	protected updateNpmPackageName(name: string): void {
		this.npmModel.update((model) => ({
			...model,
			pkg: { ...model.pkg, name }
		}));
	}

	protected updateNpmPackageVersion(version: string): void {
		this.npmModel.update((model) => ({
			...model,
			pkg: { ...model.pkg, version }
		}));
	}

	protected updatePrivateUrl(privateURL: string): void {
		this.npmModel.update((model) => ({
			...model,
			registry: { ...model.registry, privateURL }
		}));
	}

	protected installPluginFromNPM(): void {
		const model = this.npmModel();
		if (!model.pkg.name?.trim()) {
			this.error.set('TIMER_TRACKER.SETTINGS.PACKAGE_NAME_REQUIRED');
			return;
		}
		this.error.set(null);
		this.action.dispatch(PluginInstallationActions.install({ ...model, contextType: 'npm' }));
	}

	protected close(): void {
		this.dialogRef.close();
	}

	protected reset(): void {
		this.context.set('local');
		this.error.set(null);
		this.cdnUrl.set('');
		this.npmModel.set({
			pkg: {
				name: null,
				version: null
			},
			registry: {
				privateURL: null,
				authToken: null
			}
		});
	}

	protected toggleRegistry(enabled: boolean): void {
		this.showRegistry.set(enabled);
	}

	protected switchContext(contextType: PluginContext): void {
		this.context.set(contextType);
		this.error.set(null);
	}
}
