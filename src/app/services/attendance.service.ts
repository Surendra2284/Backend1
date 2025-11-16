import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type AttStatus = 'Present' | 'Absent' | 'Leave';

export interface Attendance {
  _id?: string;
  // ✅ no Student object, only numeric id
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

/** NEW: exports for weekly grouping endpoint */
export interface WeekAttendance {
  weekStart: string; // ISO
  weekEnd: string;   // ISO
  records: Attendance[];
}

export interface StudentAttendanceByNameResponse {
  student: Student;
  weeks: WeekAttendance[];
}

const BASE_URL = environment.apiUrl; // assuming apiUrl already has no trailing slash
const ATTENDANCE_BASE = '/attendance';
const ATTENDANCE_PRIMARY = `${BASE_URL}/attendance/attendance`;
const ATTENDANCE_FALLBACK = `${BASE_URL}/attendance`;

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
    return this.http.get<Paginated<Attendance>>(`${BASE_URL}${ATTENDANCE_BASE}`, { params })
      .pipe(catchError(this.handleError('fetch attendance')));
  }

  /** ---------- Attendance: Bulk upsert/create ---------- */
  saveAttendanceBulk(data: {
    studentIds: (string | number)[];
    className: string;
    teacher: string;
    username: string;
    date: string;
    status: AttStatus;
  }): Observable<{ message: string; created: number; updated: number }> {
    return this.http.post<{ message: string; created: number; updated: number }>(
      `${BASE_URL}${ATTENDANCE_BASE}`,
      data
    ).pipe(catchError(this.handleError('save/upsert bulk attendance')));
  }

  /** ---------- Attendance: Correct by (studentId + date) ---------- */
  correctAttendance(payload: {
    studentId: string | number;
    date: string;
    newStatus: AttStatus;
    reason?: string;
    correctedBy?: string;
  }): Observable<{ message: string; record: Attendance } | { message: string }> {
    return this.http.patch<{ message: string; record: Attendance } | { message: string }>(
      `${BASE_URL}${ATTENDANCE_BASE}/correct`,
      payload
    ).pipe(catchError(this.handleError('correct attendance')));
  }

  /** ---------- Attendance: Patch by _id (partial) ---------- */
  patchAttendanceById(id: string, data: Partial<{
    status: AttStatus;
    date: string;
    teacher: string;
    username: string;
    className: string;
    correctedBy: string;
    reason: string;
  }>): Observable<{ message: string; record: Attendance }> {
    return this.http.patch<{ message: string; record: Attendance }>(
      `${BASE_URL}${ATTENDANCE_BASE}/${encodeURIComponent(id)}`,
      data
    ).pipe(catchError(this.handleError('update attendance')));
  }

  /** ---------- Attendance: Delete by _id ---------- */
  deleteAttendance(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${BASE_URL}${ATTENDANCE_BASE}/${encodeURIComponent(id)}`
    ).pipe(catchError(this.handleError('delete attendance')));
  }

  /** ---------- Helpers ---------- */

  getAttendanceArray(filters?: any): Observable<Attendance[]> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });
    const params = new HttpParams({ fromObject: clean });

    return this.http.get<any>(ATTENDANCE_PRIMARY, { params }).pipe(
      catchError(errPrimary => {
        console.warn('Primary attendance endpoint failed, trying fallback', errPrimary?.status);
        return this.http.get<any>(ATTENDANCE_FALLBACK, { params }).pipe(
          catchError(errFallback => {
            console.warn('Fallback attendance endpoint also failed', errFallback?.status);
            return of([] as Attendance[]);
          })
        );
      }),
      map(res => Array.isArray(res) ? res : (res?.data ?? [] as Attendance[])),
      catchError(err => {
        console.error('Unexpected error normalizing attendance response', err);
        return of([] as Attendance[]);
      })
    );
  }

  checkAttendanceExists(filters?: {
    studentId?: string | number;
    date?: string;
  }): Observable<boolean> {
    const clean: Record<string, string> = {};
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && String(v).trim() !== '') clean[k] = String(v);
    });
    const params = new HttpParams({ fromObject: clean });

    return this.http.get<any>(`${BASE_URL}/attendance`, { params }).pipe(
      map(res => {
        const arr = Array.isArray(res) ? res : (res?.data ?? []);
        return Array.isArray(arr) && arr.length > 0;
      }),
      catchError(errPrimary => {
        console.warn('Primary endpoint failed, trying fallback', errPrimary?.status);
        return this.http.get<any>(`${BASE_URL}/attendance/attendance`, { params }).pipe(
          map(res => {
            const arr = Array.isArray(res) ? res : (res?.data ?? []);
            return Array.isArray(arr) && arr.length > 0;
          }),
          catchError(errFallback => {
            console.error('checkAttendanceExists: both endpoints failed', errFallback);
            return of(false);
          })
        );
      })
    );
  }

  getAttendanceByUser(username: string, options?: {
    page?: number | string;
    limit?: number | string;
    status?: AttStatus | string;
    dateFrom?: string | Date;
    dateTo?: string | Date;
  }): Observable<Paginated<Attendance>> {
    if (!username || !String(username).trim()) {
      return throwError(() => new Error('username is required'));
    }

    const clean: Record<string, string> = { username: String(username).trim() };

    if (options?.page != null) clean['page'] = String(options.page);
    if (options?.limit != null) clean['limit'] = String(options.limit);
    if (options?.status != null && String(options.status).trim() !== '') clean['status'] = String(options.status);

    if (options?.dateFrom != null) {
      const d = new Date(options.dateFrom);
      if (Number.isNaN(d.getTime())) {
        return throwError(() => new Error('Invalid dateFrom'));
      }
      clean['dateFrom'] = d.toISOString();
    }

    if (options?.dateTo != null) {
      const d = new Date(options.dateTo);
      if (Number.isNaN(d.getTime())) {
        return throwError(() => new Error('Invalid dateTo'));
      }
      clean['dateTo'] = d.toISOString();
    }

    const params = new HttpParams({ fromObject: clean });

    const primaryUrl = `${BASE_URL}/attendance/ByUserName`;
    const fallbackUrl = `${BASE_URL}/attendance/attendance/ByUserName`;

    const callUrl = (url: string) =>
      this.http.get<Paginated<Attendance>>(url, { params, observe: 'response' as const }).pipe(
        map(resp => {
          const bodyAny: any = resp.body as any;
          if (!bodyAny) {
            throw new Error(`Empty response body (status: ${resp.status})`);
          }
          if (Array.isArray(bodyAny)) {
            return { total: bodyAny.length, page: 1, limit: bodyAny.length, data: bodyAny } as Paginated<Attendance>;
          }
          if (bodyAny.data && Array.isArray(bodyAny.data)) {
            return bodyAny as Paginated<Attendance>;
          }
          return bodyAny as Paginated<Attendance>;
        }),
        catchError(err => {
          const status = (err?.status != null) ? `status ${err.status}` : '';
          const serverMsg = err?.error?.message || err?.message || '';
          const msg = `Failed to fetch attendance by user. ${status} ${serverMsg}`.trim();
          return throwError(() => new Error(msg));
        })
      );

    return callUrl(primaryUrl).pipe(
      catchError(primaryErr => {
        console.warn('[AttendanceService] primary getAttendanceByUser failed:', primaryErr?.message || primaryErr);
        return callUrl(fallbackUrl).pipe(
          catchError(fallbackErr => {
            console.error('[AttendanceService] fallback getAttendanceByUser also failed:', fallbackErr?.message || fallbackErr);
            const combined = `Primary error: ${primaryErr?.message || primaryErr}. Fallback error: ${fallbackErr?.message || fallbackErr}`;
            return throwError(() => new Error(combined));
          })
        );
      })
    );
  }

  getAttendanceByStudentName(name: string, weeks: number = 1): Observable<StudentAttendanceByNameResponse> {
    if (!name || !String(name).trim()) {
      return throwError(() => new Error('name is required'));
    }

    const cleanName = String(name).trim();
    const w = Math.max(1, Math.min(52, Number(weeks) || 1));

    let params = new HttpParams().set('name', cleanName).set('weeks', String(w));

    const url = `${BASE_URL}/attendance/ByStudentName`;
    console.debug('[AttendanceService] getAttendanceByStudentName ->', {
      url,
      params: Object.fromEntries(params.keys().map(k => [k, params.get(k)]))
    });

    return this.http.get<StudentAttendanceByNameResponse>(url, { params }).pipe(
      map(resp => {
        if (!resp) throw new Error('Empty response from server');
        return {
          student: resp.student,
          weeks: Array.isArray(resp.weeks) ? resp.weeks : []
        } as StudentAttendanceByNameResponse;
      }),
      catchError(err => {
        const msg = err?.error?.message || err?.message || 'Failed to fetch student attendance';
        return throwError(() => new Error(msg));
      })
    );
  }

  getAttendanceListOnly(filters?: Parameters<AttendanceService['getAttendance']>[0]): Observable<Attendance[]> {
    return this.getAttendanceArray(filters);
  }

  private handleError(operation: string) {
    return (error: any) => {
      console.error(`Error during ${operation}:`, error);
      return throwError(() => new Error(`Failed to ${operation}.`));
    };
  }
}
