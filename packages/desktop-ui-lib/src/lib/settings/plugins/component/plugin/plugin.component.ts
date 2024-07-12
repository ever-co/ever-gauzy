import { Component, inject, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { from, tap } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PluginLoaderService } from '../../services/plugin-loader.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plugin',
	templateUrl: './plugin.component.html',
	styleUrls: ['./plugin.component.scss']
})
export class PluginComponent implements OnInit, OnDestroy {
	private readonly loaderService = inject(PluginLoaderService);
	private readonly electronService = inject(PluginElectronService);
	private readonly route = inject(ActivatedRoute);
	private _renderer: ViewContainerRef;

	ngOnInit(): void {
		const pluginName = this.route.snapshot.params.name;
		from(this.electronService.plugin(pluginName))
			.pipe(
				tap((plugin) => this.loaderService.loadComponent(plugin, this.renderer)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	@ViewChild('renderer')
	public set renderer(value: ViewContainerRef) {
		if (value) {
			this._renderer = value;
		}
	}

	public get renderer(): ViewContainerRef {
		return this._renderer;
	}

	ngOnDestroy(): void {
		this.loaderService.unloadComponent();
	}
}
