import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type AttStatus = 'Present' | 'Absent' | 'Leave';

export interface Attendance {
  _id?: string;
  student: Student | string; // populated when fetched
  className: string;
  teacher: string;
  username: string;
  date: string;              // send as YYYY-MM-DD from UI; backend normalizes to UTC day-start
  status: AttStatus;
  correctionHistory?: Array<{
    changedAt?: string;
    changedBy?: string;
    fromStatus?: AttStatus | string;
    toStatus?: AttStatus | string;
    reason?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  _id: string;
  studentId: number;
  name: string;
  class: string;
  classteacher?: string;
}

export interface Paginated<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

const BASE_URL = (environment.apiUrl || '').replace(/\/+$/, '');
const ATTENDANCE_PATH = '/attendance';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private http: HttpClient) {}

  /** ---------- Students ---------- */
  getStudents(params?: Partial<{ className: string; name: string; studentId: string | number }>): Observable<Student[]> {
    const clean: Record<string, string> = {};
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });
    return this.http.get<Student[]>(`${BASE_URL}/students`, { params: clean })
      .pipe(catchError(this.handleError('fetch students')));
  }

  /** ---------- Attendance: Read (paginated) ---------- */
  getAttendance(filters?: {
    className?: string;
    name?: string;
    username?: string;
    studentId?: string | number;
    date?: string;            // YYYY-MM-DD
    status?: AttStatus;
    page?: number | string;
    limit?: number | string;
  }): Observable<Paginated<Attendance>> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });
    const params = new HttpParams({ fromObject: clean });
    return this.http.get<Paginated<Attendance>>(`${BASE_URL}${ATTENDANCE_PATH}`, { params })
      .pipe(catchError(this.handleError('fetch attendance')));
  }

  /** ---------- Attendance: Bulk upsert/create ---------- */
  saveAttendanceBulk(data: {
    studentIds: string[];     // can be ObjectIds or school numeric ids as strings
    className: string;
    teacher: string;
    username: string;
    date: string;             // YYYY-MM-DD
    status: AttStatus;
  }): Observable<{ message: string; created: number; updated: number }> {
    return this.http.post<{ message: string; created: number; updated: number }>(`${BASE_URL}${ATTENDANCE_PATH}`, data)
      .pipe(catchError(this.handleError('save/upsert bulk attendance')));
  }

  /** ---------- Attendance: Correct by (studentId + date) ---------- */
  correctAttendance(payload: {
    studentId: string | number; // accepts ObjectId or school roll number
    date: string;               // YYYY-MM-DD
    newStatus: AttStatus;
    reason?: string;
    correctedBy?: string;       // typically current username
  }): Observable<{ message: string; record: Attendance } | { message: string }> {
    return this.http.patch<{ message: string; record: Attendance } | { message: string }>(
      `${BASE_URL}${ATTENDANCE_PATH}/correct`,
      payload
    ).pipe(catchError(this.handleError('correct attendance')));
  }

  /** ---------- Attendance: Patch by _id (partial) ---------- */
  patchAttendanceById(id: string, data: Partial<{
    status: AttStatus;
    date: string;              // YYYY-MM-DD
    teacher: string;
    username: string;
    className: string;
    correctedBy: string;
    reason: string;
  }>): Observable<{ message: string; record: Attendance }> {
    return this.http.patch<{ message: string; record: Attendance }>(
      `${BASE_URL}${ATTENDANCE_PATH}/${encodeURIComponent(id)}`,
      data
    ).pipe(catchError(this.handleError('update attendance')));
  }

  /** ---------- Attendance: Delete by _id ---------- */
  deleteAttendance(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE_URL}${ATTENDANCE_PATH}/${encodeURIComponent(id)}`)
      .pipe(catchError(this.handleError('delete attendance')));
  }

  /** ---------- Helpers ---------- */
  /** Extract only array data if you want convenience for tables: */
  getAttendanceListOnly(filters?: Parameters<AttendanceService['getAttendance']>[0]): Observable<Attendance[]> {
    return this.getAttendance(filters).pipe(map(p => p.data));
  }

  private handleError(operation: string) {
    return (error: any) => {
      console.error(`Error during ${operation}:`, error);
      return throwError(() => new Error(`Failed to ${operation}.`));
    };
  }
}
