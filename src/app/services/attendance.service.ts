import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type AttStatus = 'Present' | 'Absent' | 'Leave';

export interface Attendance {
  _id?: string;
  studentId: number;
  className: string;
  teacher: string;
  username: string;
  date: string;
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

export interface WeekAttendance {
  weekStart: string;
  weekEnd: string;
  records: Attendance[];
}

export interface StudentAttendanceByNameResponse {
  student: Student;
  weeks: WeekAttendance[];
}

const BASE_URL = environment.apiUrl;

// Your actual working backend endpoints
const PRIMARY = `${BASE_URL}/attendance/attendance`;
const FALLBACK = `${BASE_URL}/attendance`;

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private http: HttpClient) {}

  /**
   * 🔹 Get students
   */
  getStudents(params?: Partial<{ className: string; name: string; studentId: string | number }>): Observable<Student[]> {
    const clean: Record<string, string> = {};
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });

    return this.http
      .get<Student[]>(`${BASE_URL}/students`, { params: clean })
      .pipe(catchError(this.handleError('fetch students')));
  }

  /**
   * 🔹 Get attendance (paginated)
   */
  getAttendance(filters?: {
    className?: string;
    name?: string;
    username?: string;
    studentId?: string | number;
    date?: string;
    status?: AttStatus;
    page?: number | string;
    limit?: number | string;
  }): Observable<Paginated<Attendance>> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });

    const params = new HttpParams({ fromObject: clean });

    return this.http
      .get<Paginated<Attendance>>(PRIMARY, { params })
      .pipe(catchError(this.handleError('fetch attendance')));
  }

  /**
   * 🔹 Bulk or Single Attendance Save
   */
  saveAttendanceBulk(data: {
    studentIds: (string | number)[];
    className: string;
    teacher: string;
    username: string;
    date: string;
    status: AttStatus;
  }): Observable<{ message: string; created: number; updated: number }> {
    return this.http
      .post<{ message: string; created: number; updated: number }>(PRIMARY, data)
      .pipe(catchError(this.handleError('save/upsert bulk attendance')));
  }

  /**
   * 🔹 Correct Attendance by (studentId + date)
   */
  correctAttendance(payload: {
    studentId: string | number;
    date: string;
    newStatus: AttStatus;
    reason?: string;
    correctedBy?: string;
  }): Observable<{ message: string; record: Attendance } | { message: string }> {
    return this.http
      .patch<{ message: string; record: Attendance } | { message: string }>(`${PRIMARY}/correct`, payload)
      .pipe(catchError(this.handleError('correct attendance')));
  }

  /**
   * 🔹 Patch Attendance by ID
   */
  patchAttendanceById(
    id: string,
    data: Partial<{
      status: AttStatus;
      date: string;
      teacher: string;
      username: string;
      className: string;
      correctedBy: string;
      reason: string;
    }>
  ): Observable<{ message: string; record: Attendance }> {
    return this.http
      .patch<{ message: string; record: Attendance }>(`${PRIMARY}/${encodeURIComponent(id)}`, data)
      .pipe(catchError(this.handleError('update attendance')));
  }

  /**
   * 🔹 Delete Attendance
   */
  deleteAttendance(id: string): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${PRIMARY}/${encodeURIComponent(id)}`)
      .pipe(catchError(this.handleError('delete attendance')));
  }

  /**
   * 🔹 Get Attendance Array (non-paginated)
   */
  getAttendanceArray(filters?: any): Observable<Attendance[]> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });
    const params = new HttpParams({ fromObject: clean });

    return this.http.get<any>(PRIMARY, { params }).pipe(
      catchError((errPrimary) => {
        console.warn('Primary attendance endpoint failed, trying fallback', errPrimary?.status);

        return this.http.get<any>(FALLBACK, { params }).pipe(
          catchError((errFallback) => {
            console.warn('Fallback attendance endpoint also failed', errFallback?.status);
            return of([] as Attendance[]);
          })
        );
      }),
      map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
      catchError((err) => {
        console.error('Unexpected error normalizing attendance response', err);
        return of([] as Attendance[]);
      })
    );
  }

  /**
   * 🔹 Check if attendance exists
   */
  checkAttendanceExists(filters?: { studentId?: string | number; date?: string }): Observable<boolean> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });

    const params = new HttpParams({ fromObject: clean });

    return this.http.get<any>(`${BASE_URL}/attendance/attendance`, { params }).pipe(
      map((res) => {
        const arr = Array.isArray(res) ? res : res?.data ?? [];
        return arr.length > 0;
      }),
      catchError((errPrimary) => {
        console.warn('Primary endpoint failed, trying fallback', errPrimary?.status);

        return this.http.get<any>(`${BASE_URL}/attendance`, { params }).pipe(
          map((res) => {
            const arr = Array.isArray(res) ? res : res?.data ?? [];
            return arr.length > 0;
          }),
          catchError((errFallback) => {
            console.error('checkAttendanceExists: both endpoints failed', errFallback);
            return of(false);
          })
        );
      })
    );
  }

  /**
   * 🔹 Get attendance by username
   */
  getAttendanceByUser(
    username: string,
    options?: {
      page?: number | string;
      limit?: number | string;
      status?: AttStatus | string;
      dateFrom?: string | Date;
      dateTo?: string | Date;
    }
  ): Observable<Paginated<Attendance>> {
    if (!username || !String(username).trim()) {
      return throwError(() => new Error('username is required'));
    }

    const clean: Record<string, string> = { username: String(username).trim() };

    if (options?.page != null) clean['page'] = String(options.page);
    if (options?.limit != null) clean['limit'] = String(options.limit);
    if (options?.status != null && String(options.status).trim() !== '') clean['status'] = String(options.status);

    if (options?.dateFrom != null) clean['dateFrom'] = new Date(options.dateFrom).toISOString();
    if (options?.dateTo != null) clean['dateTo'] = new Date(options.dateTo).toISOString();

    const params = new HttpParams({ fromObject: clean });

    const primary = `${BASE_URL}/attendance/attendance/ByUserName`;
    const fallback = `${BASE_URL}/attendance/attendance/ByUserName`; // same, consistent

    const callUrl = (url: string) =>
      this.http.get<Paginated<Attendance>>(url, { params, observe: 'response' as const }).pipe(
        map((resp) => {
          const data: any = resp.body;
          if (!data) throw new Error(`Empty response (status: ${resp.status})`);
          if (Array.isArray(data)) {
            return { total: data.length, page: 1, limit: data.length, data };
          }
          return data;
        }),
        catchError((err) => {
          const msg = `Failed to fetch attendance by user. status ${err?.status} ${err?.error?.message || err?.message}`;
          return throwError(() => new Error(msg));
        })
      );

    return callUrl(primary).pipe(
      catchError((primaryErr) => {
        return callUrl(fallback).pipe(
          catchError((fallbackErr) => {
            const combined = `Primary error: ${primaryErr?.message}. Fallback error: ${fallbackErr?.message}`;
            return throwError(() => new Error(combined));
          })
        );
      })
    );
  }

  /**
   * 🔹 Get attendance by student name
   */
  getAttendanceByStudentName(name: string, weeks = 1): Observable<StudentAttendanceByNameResponse> {
    if (!name || !String(name).trim()) {
      return throwError(() => new Error('name is required'));
    }

    const params = new HttpParams()
      .set('name', String(name).trim())
      .set('weeks', String(Math.max(1, Math.min(52, weeks))));

    const url = `${BASE_URL}/attendance/ByStudentName`;

    return this.http.get<StudentAttendanceByNameResponse>(url, { params }).pipe(
      map((resp) => {
        if (!resp) throw new Error('Empty response from server');
        return {
          student: resp.student,
          weeks: Array.isArray(resp.weeks) ? resp.weeks : [],
        };
      }),
      catchError((err) => {
        const msg = err?.error?.message || err?.message || 'Failed to fetch student attendance';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * 🔹 Utility: list only
   */
  getAttendanceListOnly(filters?: Parameters<AttendanceService['getAttendance']>[0]): Observable<Attendance[]> {
    return this.getAttendanceArray(filters);
  }

  /**
   * 🔹 Error handler
   */
  private handleError(operation: string) {
    return (error: any) => {
      console.error(`Error during ${operation}:`, error);
      return throwError(() => new Error(`Failed to ${operation}.`));
    };
  }
}
