// src/app/services/teacher.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Teacher } from '../components/models/Teacher';

const BASE = `${environment.apiUrl}/teachers`;

@Injectable({ providedIn: 'root' })
export class TeacherService {
  constructor(private http: HttpClient) {}

  /** List (backend returns _id + teacherid (fallbacks to _id string)) */
  getTeachers(): Observable<Teacher[]> {
    return this.http.get<any[]>(BASE).pipe(
      map(list => (list || []).map(t => ({
        ...t,
        // ensure teacherid always present for UI + write operations
        teacherid: t.teacherid || t._id
      }))),
      catchError(this.handle('fetch teachers'))
    );
  }

  /** Get by username (actually name in backend) */
  getTeacherByUsername(username: string): Observable<Teacher> {
    return this.http.get<Teacher>(`${BASE}/username/${encodeURIComponent(username)}`)
      .pipe(catchError(this.handle('fetch teacher by username')));
  }

  /** Create */
  addTeacher(data: Partial<Teacher>): Observable<any> {
    return this.http.post(BASE, data)
      .pipe(catchError(this.handle('add teacher')));
  }

  /** Update — IMPORTANT: backend expects :id = teacherid */
  editTeacher(teacherid: string, patch: Partial<Teacher>): Observable<any> {
    return this.http.put(`${BASE}/${encodeURIComponent(teacherid)}`, patch)
      .pipe(catchError(this.handle('edit teacher')));
  }

  /** Delete — IMPORTANT: backend expects :id = teacherid */
  deleteTeacher(teacherid: string): Observable<any> {
    return this.http.delete(`${BASE}/${encodeURIComponent(teacherid)}`)
      .pipe(catchError(this.handle('delete teacher')));
  }

  private handle(op: string) {
    return (err: any) => {
      console.error(`Error during ${op}:`, err);
      return throwError(() => new Error(`Failed to ${op}.`));
    };
  }
}
