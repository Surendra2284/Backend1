import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const complainurl = `${environment.apiUrl}/complains`;
@Injectable({ providedIn: 'root' })
export class ComplainService {

  private api = complainurl;
  constructor(private http: HttpClient) {}

  add(data: any): Observable<any> {
    return this.http.post(this.api, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.put(`${this.api}/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.api);
  }

  getByUsername(username: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/by-username/${username}`);
  }

  getByClass(cls: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/by-class/${cls}`);
  }

  getResolved(status: boolean): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/by-resolved/${status}`);
  }

  getUnresolved(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/unresolved`);
  }

  // 🔔 future notification hook
  notifyAdmin(payload: any) {
    return this.http.post(`${this.api}/notify`, payload);
  }
}
