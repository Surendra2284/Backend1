// src/app/services/student-progress.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const baseUrl1 = `${environment.apiUrl}/StudentProgress`;
export type ProgressStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'Needs Attention';

export interface StudentProgress {
  _id?: string;
  student?: string; // Mongo ObjectId
  studentId: number;

  className: string;
  section?: string;
  subject: string;

  teacher: string;
  username: string;

  date: string; // 'YYYY-MM-DD'
  homework: string;
  progressNote?: string;
  status?: ProgressStatus;
  score?: number;

  createdAt?: string;
  updatedAt?: string;
}

export interface BulkProgressEntry {
  studentId: number;
  progressNote?: string;
  status?: ProgressStatus;
  score?: number;
}

export interface BulkProgressPayload {
  className: string;
  section?: string;
  subject: string;
  date: string; // 'YYYY-MM-DD'
  homework: string;
  teacher: string;
  username: string;
  entries: BulkProgressEntry[];
}

@Injectable({
  providedIn: 'root',
})
export class StudentProgressService {
  // adjust to your backend base URL if needed
  private baseUrl = baseUrl1

  constructor(private http: HttpClient) {}

  /** ADD / UPSERT single progress record */
  createProgress(data: {
    studentId: number;
    className?: string;
    section?: string;
    subject: string;
    date: string;
    homework: string;
    teacher: string;
    username: string;
    progressNote?: string;
    status?: ProgressStatus;
    score?: number;
  }): Observable<{ message: string; data: StudentProgress }> {
    return this.http.post<{ message: string; data: StudentProgress }>(
      `${this.baseUrl}`,
      data
    );
  }

  /** Bulk upsert for a whole class */
  saveBulkProgress(payload: BulkProgressPayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/bulk`, payload);
  }

  /** Get progress list for a class (optionally filtered by date & subject) */
  getProgressByClass(params: {
    className: string;
    date?: string;
    subject?: string;
  }): Observable<StudentProgress[]> {
    let httpParams = new HttpParams().set('className', params.className);

    if (params.date) {
      httpParams = httpParams.set('date', params.date);
    }
    if (params.subject) {
      httpParams = httpParams.set('subject', params.subject);
    }

    return this.http.get<StudentProgress[]>(`${this.baseUrl}/class`, {
      params: httpParams,
    });
  }

  /** Get progress history for one student */
  getProgressByStudent(
    studentId: number,
    options?: { fromDate?: string; toDate?: string }
  ): Observable<StudentProgress[]> {
    let httpParams = new HttpParams();
    if (options?.fromDate) {
      httpParams = httpParams.set('fromDate', options.fromDate);
    }
    if (options?.toDate) {
      httpParams = httpParams.set('toDate', options.toDate);
    }

    return this.http.get<StudentProgress[]>(
      `${environment.apiUrl}/student/${studentId}`,
      { params: httpParams }
    );
  }

  /** Update single progress record */
  updateProgress(
    id: string,
    data: Partial<StudentProgress>
  ): Observable<StudentProgress> {
    return this.http.put<StudentProgress>(`${this.baseUrl}/${id}`, data);
  }

  /** Delete single progress record */
  deleteProgress(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
