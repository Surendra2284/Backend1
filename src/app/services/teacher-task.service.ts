import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
const teacherTaskUrl = `${environment.apiUrl}/teachertask`;
export interface TeacherTask {
  _id?: string;
  taskCreateDate?: Date;
  taskForUser: string;
  class: string;
  taskGivenBy: string;
  taskDescription: string;
  completedOn?: Date;
  delayReason?: string;
  replyDate?: Date;
  complainResolve?: boolean;
  other?: string;
  updatedOn?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TeacherTaskService {

  private apiUrl = teacherTaskUrl;
  constructor(private http: HttpClient) {}

  addTask(task: TeacherTask): Observable<any> {
    return this.http.post(`${this.apiUrl}/add`, task);
  }

  getAllTasks(): Observable<TeacherTask[]> {
    return this.http.get<TeacherTask[]>(`${this.apiUrl}/all`);
  }

  getTasksByUser(username: string): Observable<TeacherTask[]> {
    return this.http.get<TeacherTask[]>(`${this.apiUrl}/by-user/${username}`);
  }

  getTasksByDate(date: string): Observable<TeacherTask[]> {
    return this.http.get<TeacherTask[]>(`${this.apiUrl}/by-date/${date}`);
  }

  getTasksByDateRange(startDate: string, endDate: string): Observable<TeacherTask[]> {
    return this.http.get<TeacherTask[]>(
      `${this.apiUrl}/by-date-range?startDate=${startDate}&endDate=${endDate}`
    );
  }

  updateTask(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/update/${id}`, data);
  }

  markCompleted(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/update/${id}`, {
      completedOn: new Date(),
      complainResolve: true
    });
  }

  deleteTask(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${id}`);
  }
}
