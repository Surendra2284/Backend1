import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const notification = `${environment.apiUrl}/notifications`;

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private apiUrl = notification;

  constructor(private http: HttpClient) {}

  getMyNotifications(username: string) {
    return this.http.get<any[]>(`${this.apiUrl}/user/${username}`);
  }

  markRead(id: string) {
    return this.http.patch(`${this.apiUrl}/read/${id}`, {});
  }
}
