import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Tag } from "@gauzy/models";
import { first } from 'rxjs/operators';


@Injectable()
export class TagsService {
  constructor(private http: HttpClient) {}

  
  insertTag(createTag: Tag): Promise <Tag> {
    return this.http
    .post<Tag>('/api/tags/create',createTag)
    .pipe(first())
    .toPromise();
  }

  getAllTags(): Promise<{items:Tag[]}>{
    const test = this.http.get<{ items: Tag[]}>(`/api/tags`).pipe(first()).toPromise();
    console.warn(test);
    return this.http.get<{ items: Tag[]}>(`/api/tags`).pipe(first()).toPromise();
  }

}
