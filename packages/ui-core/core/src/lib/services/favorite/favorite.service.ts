import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IFavorite, IFavoriteCreateInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class FavoriteService {
	FAVORITE_URL = `${API_PREFIX}/favorite`;

	constructor(private http: HttpClient) {}

	create(favorite: IFavoriteCreateInput): Promise<IFavorite> {
		return firstValueFrom(this.http.post<IFavorite>(`${this.FAVORITE_URL}`, favorite));
	}

	findByEmployee(params?: any): Promise<{ items: IFavorite[]; total: number }> {
		return firstValueFrom(
			this.http.get<{ items: IFavorite[]; total: number }>(`${this.FAVORITE_URL}/employee`, {
				params: toParams(params)
			})
		);
	}

	getFavoriteDetails(params?: any): Promise<{ items: IFavorite[]; total: number }> {
		return firstValueFrom(
			this.http.get<{ items: IFavorite[]; total: number }>(`${this.FAVORITE_URL}/type`, {
				params: toParams(params)
			})
		);
	}

	findAll(params?: any): Promise<{ items: IFavorite[]; total: number }> {
		return firstValueFrom(
			this.http.get<{ items: IFavorite[]; total: number }>(`${this.FAVORITE_URL}`, {
				params: toParams(params)
			})
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.FAVORITE_URL}/${id}`));
	}
}
