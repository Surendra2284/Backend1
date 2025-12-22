import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
 const studentUrl= `${environment.apiUrl}/students`;
export interface Student {
  studentId: number;
  name: string;
  class: string;
  mobileNo: string;
  address: string;
  Role: string;
  Notice?: string;
  Email: string;
  attendance: number;   // ✅ should be number, not Date
  photo: string;   
  classteacher?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private apiUrl = studentUrl; // Backend API URL

  constructor(private http: HttpClient) {}

  /** --- Get All Students (with Optional Filters and Pagination) --- */
  getStudents(filters?: any): Observable<Student[]> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        params = params.append(key, filters[key]);
      });
    }

    return this.http.get<Student[]>(`${this.apiUrl}?limit=999999&skip=0`, { params })
.pipe(
      catchError(error => {
        console.error('Error fetching students:', error);
        
        return throwError(() => new Error('Failed to fetch students.'));
      })
    );
  }

  /** --- Get a Single Student by ID --- */
  getStudentById(studentId: number): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/${studentId}`).pipe(
      catchError(error => {
        console.error('Error fetching student by ID:', error);
        return throwError(() => new Error('Failed to fetch student by ID.'));
      })
    );
  }
bulkUpdateNoticeAndAttendance(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return this.http.post(`${this.apiUrl}/bulk-notice`, formData);
}

  /** --- Add a New Student --- */
  addStudent(student: Student): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/add`, student).pipe(
      catchError(error => {
        console.error('Error adding student:', error);
        return throwError(() => new Error('Failed to add student.'));
      })
    );
  }
  getAllClasses(): Observable<string[]> {
  return this.http.get<string[]>(`${this.apiUrl}/classes/list`);
}

  /** --- Update an Existing Student --- */
  updateStudent(studentId: number, student: Partial<Student>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/update/${studentId}`, student).pipe(
      catchError(error => {
        console.error('Error updating student:', error);
        return throwError(() => new Error('Failed to update student.'));
      })
    );
  }
// student.service.ts
updateStudentNotice(studentId: number, data: { notice: string }) {
  return this.http.put<any>(
    `${this.apiUrl}/students/update-notice/${studentId}`,
    data
  );
}

  /** --- Delete a Student --- */
  deleteStudent(studentId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/delete/${studentId}`).pipe(
      catchError(error => {
        console.error('Error deleting student:', error);
        return throwError(() => new Error('Failed to delete student.'));
      })
    );
  }

  /** --- Search Students by Class --- */
  searchStudentsByClass(className: string, filters?: any): Observable<Student[]> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        params = params.append(key, filters[key]);
      });
    }

    return this.http.get<Student[]>(`${this.apiUrl}/class/${className}`, { params }).pipe(
      catchError(error => {
        console.error('Error searching students by class:', error);
        return throwError(() => new Error('Failed to search students by class.'));
      })
    );
  }
getAllStudentsFull(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}`, {
    params: { limit: '999999', skip: '0' }
  });
}




  /** --- Search Students by Name --- */
  searchStudentsByName(name: string, filters?: any): Observable<Student[]> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        params = params.append(key, filters[key]);
      });
    }

    return this.http.get<Student[]>(`${this.apiUrl}/name/${name}`, { params }).pipe(
      catchError(error => {
        console.error('Error searching students by name:', error);
        return throwError(() => new Error('Failed to search students by name.'));
      })
    );
  }bulkAddStudents(payload: any[], options?: { upsert?: boolean }) {
    const upsert = options?.upsert ? 'true' : 'false';
    return this.http.post<{ inserted: number; updated: number; skipped: number; errors: any[] }>(
      `${this.apiUrl}/bulk?upsert=${upsert}`,
      { students: payload }
    );
    }
}
