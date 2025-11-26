import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
 _id?: string;
  username: string;
  password?: string;
  role: string;
  isApproved: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getUsersByApproval(isApproved: boolean): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/isApproved/${isApproved}`);
  }

  getPendingUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/pending-users`);
  }

  approveUser(userId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/approve-user/${userId}`, {});
  }

  addUser(user: User): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  // NEW — FIXED ROUTE
  getUserByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/by-username/${username}`);
  }

  updateUser(id: string, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
getLoggedUser() {
  return {
    username: localStorage.getItem("username") || "",
    userId: localStorage.getItem("userId") || "",
    role: localStorage.getItem("role") || ""
  };
}
getUserDetails() {
  return {
    username: localStorage.getItem("username") || "",
    userId: localStorage.getItem("userId") || "",
    role: localStorage.getItem("role") || ""
  };
}
  bulkAddUsers(data: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/bulk`, { users: data });
  }
}
