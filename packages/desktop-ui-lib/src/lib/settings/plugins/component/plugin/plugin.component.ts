import { AfterViewInit, Component, inject, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DynamicDirective } from '../../../../directives/dynamic.directive';
import { concatMap, from } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PluginLoaderService } from '../../services/plugin-loader.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plugin',
	templateUrl: './plugin.component.html',
	styleUrls: ['./plugin.component.scss']
})
export class PluginComponent implements AfterViewInit {
	private readonly loaderService = inject(PluginLoaderService);
	private readonly electronService = inject(PluginElectronService);
	private readonly route = inject(ActivatedRoute);
	private _renderer: DynamicDirective;

	@ViewChild(DynamicDirective, { static: true })
	public set renderer(value: DynamicDirective) {
		if (value) {
			this._renderer = value;
		}
	}

	public get renderer(): DynamicDirective {
		return this._renderer;
	}

	ngAfterViewInit(): void {
		from(this.electronService.plugin(this.route.snapshot.params.name))
			.pipe(
				concatMap((plugin) => this.loaderService.load(plugin, this.renderer.viewContainerRef)),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
