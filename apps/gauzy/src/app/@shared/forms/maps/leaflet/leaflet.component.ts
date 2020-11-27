import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { latLng, tileLayer } from 'leaflet';

@Component({
	selector: 'ga-leaflet-map',
	templateUrl: './leaflet.component.html',
	styleUrls: ['./leaflet.component.scss']
})
export class LeafletMapComponent implements OnInit, AfterViewInit {
	options: any;
	loaded: boolean;

	constructor(private cdr: ChangeDetectorRef) {}

	ngOnInit() {
		this.loaded = false;
	}

	ngAfterViewInit() {
		this.options = {
			layers: [
				tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					maxZoom: 18
				})
			],
			zoom: 15,
			center: latLng(
				environment.DEFAULT_LATITUDE,
				environment.DEFAULT_LONGITUDE
			)
		};
		this.loaded = true;
		this.cdr.detectChanges();
	}

	onMapReady(map: any) {
		console.log(map);
		// Do stuff with map
	}
	onMapMove(map: any) {
		console.log(map);
		// Do stuff with map
	}
	onMapMoveStart(map: any) {
		console.log(map);
		// Do stuff with map
	}
	onMapMoveEnd(map: any) {
		console.log(map);
		// Do stuff with map
	}
	onMapZoom(map: any) {
		console.log(map);
		// Do stuff with map
	}
	onMapZoomStart(map: any) {
		console.log(map);
		// Do stuff with map
	}
	onMapZoomEnd(map: any) {
		console.log(map);
		// Do stuff with map
	}
}
