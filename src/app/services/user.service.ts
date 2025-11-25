import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;
  private role: string = '';
  private username: string = '';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<any> {
    return this.http.get(this.apiUrl);
  }
  getUsersByApproval(isApproved: boolean): Observable<any> {
    return this.http.get(`${this.apiUrl}/isApproved/${isApproved}`);
  }

  getPendingUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pending-users`);
  }

  approveUser(userId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/approve-user/${userId}`, {});
  }
  getUser(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  addUser(user: any): Observable<any> {
    return this.http.post(this.apiUrl, user);
  }

  updateUser(id: string, user: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  

  setUserDetails(id: string, name: string): void {
    this.role = id;
    this.username = name;
    localStorage.setItem('userId', id);
    localStorage.setItem('username', name);
  }
getUsersbyrole(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}`);
}

bulkAddUsers(data: any[]): Observable<any> {
  return this.http.post(`${this.apiUrl}/bulk`, { users: data });
}

  getUserDetails(): { userId: string; username: string } {
    return {
      userId: this.role || localStorage.getItem('userId') || '',
      username: this.username || localStorage.getItem('username') || ''
    };
  }
}