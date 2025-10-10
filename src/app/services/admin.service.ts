// src/app/services/admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseUrl = `${environment.apiUrl}/users`; // Adjust the URL as needed

  constructor(private http: HttpClient) {}

  // Get all users who are not yet approved
  getPendingUsers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/pending-users`);
  }

  // Approve a specific user by ID
  approveUser(userId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/approve-user/${userId}`, {});
  }
}
