import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  API = 'http://localhost:5000/library';
  constructor(private http: HttpClient) {}

  getBooks() {
    return this.http.get<any[]>(`${this.API}/books`);
  }

  issueBook(data: any) {
    return this.http.post(`${this.API}/issue`, data);
  }
}
