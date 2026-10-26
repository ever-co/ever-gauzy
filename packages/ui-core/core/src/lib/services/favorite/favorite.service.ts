import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError } from 'rxjs';
import { BaseEntityEnum, ICandidate, ID, IEmployee, IFavorite, IFavoriteCreateInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class FavoriteService {
	FAVORITE_URL = `${API_PREFIX}/favorite`;

	constructor(private http: HttpClient) {}

	create(favorite: IFavoriteCreateInput): Promise<IFavorite> {
		return firstValueFrom(
			this.http.post<IFavorite>(`${this.FAVORITE_URL}`, favorite).pipe(
				catchError((error) => {
					console.error('Error creating favorite:', error);
					throw new Error('Failed to create favorite');
				})
			)
		);
	}

	findByEmployee(params?: any): Promise<{ items: IFavorite[]; total: number }> {
		return firstValueFrom(
			this.http
				.get<{ items: IFavorite[]; total: number }>(`${this.FAVORITE_URL}/employee`, {
					params: toParams(params)
				})
				.pipe(
					catchError((error) => {
						console.error('Error finding favorites by employee:', error);
						throw new Error('Failed to find favorites by employee');
					})
				)
		);
	}

	getFavoriteDetails(params?: any): Promise<{ items: IFavorite[]; total: number }> {
		return firstValueFrom(
			this.http
				.get<{ items: IFavorite[]; total: number }>(`${this.FAVORITE_URL}/type`, {
					params: toParams(params)
				})
				.pipe(
					catchError((error) => {
						console.error('Error getting favorite details:', error);
						throw new Error('Failed to get favorite details');
					})
				)
		);
	}

	/**
	 * Loads an employee or candidate together with its user, which holds the person's name.
	 */
	getPersonWithUser(entity: BaseEntityEnum.Employee | BaseEntityEnum.Candidate, id: ID): Promise<IEmployee | ICandidate> {
		const path = entity === BaseEntityEnum.Employee ? 'employee' : 'candidate';
		return firstValueFrom(
			this.http
				.get<IEmployee | ICandidate>(`${API_PREFIX}/${path}/${id}`, {
					params: toParams({ relations: ['user'] })
				})
				.pipe(
					catchError((error) => {
						console.error(`Error loading ${path} with user:`, error);
						// Rethrow as is: the caller falls back to the favorite without a name.
						throw error;
					})
				)
		);
	}

	findAll(params?: any): Promise<{ items: IFavorite[]; total: number }> {
		return firstValueFrom(
			this.http
				.get<{ items: IFavorite[]; total: number }>(`${this.FAVORITE_URL}`, {
					params: toParams(params)
				})
				.pipe(
					catchError((error) => {
						console.error('Error finding all favorites:', error);
						throw new Error('Failed to find all favorites');
					})
				)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${this.FAVORITE_URL}/${id}`).pipe(
				catchError((error) => {
					console.error('Error deleting favorite:', error);
					throw new Error('Failed to delete favorite');
				})
			)
		);
	}
}
