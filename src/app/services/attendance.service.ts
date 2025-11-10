import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type AttStatus = 'Present' | 'Absent' | 'Late';

export interface Attendance {
  _id?: string;
  student: any;            // populated Student when fetched
  className: string;
  teacher: string;
  username: string;
  date: string;            // YYYY-MM-DD from UI
  status: AttStatus;
}

export interface Student {
  _id: string;
  studentId: number;
  name: string;
  class: string;
  classteacher?: string;
}

const BASE_URL = (environment.apiUrl || '').replace(/\/+$/, '');
const ATTENDANCE_PATH = '/attendance';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private http: HttpClient) {}

  getStudents(): Observable<Student[]> {
    return this.http.get<Student[]>(`${BASE_URL}/students`)
      .pipe(catchError(this.handleError('fetch students')));
  }

  getAttendance(filters?: {
    className?: string; name?: string; username?: string; studentId?: string | number; date?: string; status?: AttStatus;
  }): Observable<Attendance[]> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });
    const params = new HttpParams({ fromObject: clean });
    return this.http.get<Attendance[]>(`${BASE_URL}${ATTENDANCE_PATH}`, { params })
      .pipe(catchError(this.handleError('fetch attendance')));
  }

  saveAttendanceBulk(data: {
    studentIds: string[]; className: string; teacher: string; username: string; date: string; status: AttStatus;
  }): Observable<{ message: string; inserted: number }> {
    return this.http.post<{ message: string; inserted: number }>(`${BASE_URL}${ATTENDANCE_PATH}`, data)
      .pipe(catchError(this.handleError('save bulk attendance')));
  }

  updateAttendance(id: string, data: Partial<{ status: AttStatus; date: string; teacher: string; username: string; className: string }>): Observable<any> {
    return this.http.put(`${BASE_URL}${ATTENDANCE_PATH}/${encodeURIComponent(id)}`, data)
      .pipe(catchError(this.handleError('update attendance')));
  }

  deleteAttendance(id: string): Observable<any> {
    return this.http.delete(`${BASE_URL}${ATTENDANCE_PATH}/${encodeURIComponent(id)}`)
      .pipe(catchError(this.handleError('delete attendance')));
  }

  private handleError(operation: string) {
    return (error: any) => {
      console.error(`Error during ${operation}:`, error);
      return throwError(() => new Error(`Failed to ${operation}.`));
    };
  }
}
