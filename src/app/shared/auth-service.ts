import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, BehaviorSubject, of, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { AuthModel } from "../shared/auth-model";
import { UserService } from "../services/user.service";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class AuthService {
  // --- State ---
  private token: string = "";
  private isAuthenticated = false;
  private logoutTimer: any;
  errorMessage: string = ""; // ✅ Added

  private authenticatedSub = new BehaviorSubject<boolean>(false);

  // --- API URLs ---
  private loginUrl = `${environment.apiUrl}/login`;
  private signupUrl = `${environment.apiUrl}/sign-up`;
  private logoutUrl = `${environment.apiUrl}/logout`;
  private updateActivityUrl = `${environment.apiUrl}/update-activity`;

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) {}

  /* ==========================================================================
      HELPER: Authorization Header
  ========================================================================== */
  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem("authToken");
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    });
  }

  /* ==========================================================================
      UPDATE USER ACTIVITY (JWT + SESSION)
  ========================================================================== */
  updateSessionActivity(): void {
    const username = localStorage.getItem("username");
    if (!username) return;

    this.http
      .post<{ message: string }>(
        this.updateActivityUrl,
        { username },
        { headers: this.authHeaders() }
      )
      .pipe(
        catchError((error) => {
          console.error("Failed to update session:", error);
          return of(null);
        })
      )
      .subscribe((res) => {
        if (res) {
          clearTimeout(this.logoutTimer);
          this.startLogoutTimer(10 * 60 * 1000);
        }
      });
  }

  /* ==========================================================================
      START LOGOUT TIMER
  ========================================================================== */
  private startLogoutTimer(duration: number): void {
    this.logoutTimer = setTimeout(() => this.logout(), duration);
  }

  /* ==========================================================================
      LOGIN
  ========================================================================== */
  loginUser(username: string, password: string, role: string): void {
    const authData: AuthModel = { username, password, role };
    this.performLocalLogout(); // clean previous state

    this.http
      .post<{ token: string; expiresIn: number }>(this.loginUrl, authData)
      .pipe(
        catchError((err) => {
          this.errorMessage = err.error?.message || "Login failed";
          alert(this.errorMessage);
          return throwError(() => err);
        })
      )
      .subscribe((res) => {
        if (!res?.token) return;

        // store token
        this.token = res.token;
        this.isAuthenticated = true;
        this.authenticatedSub.next(true);

        localStorage.setItem("authToken", res.token);
        localStorage.setItem("username", username);
        localStorage.setItem("userRole", role);

        const expiresDate = new Date(Date.now() + res.expiresIn * 1000);
        localStorage.setItem("expiresIn", expiresDate.toISOString());

        // start expiration countdown
        this.startLogoutTimer(res.expiresIn * 1000);

        // redirect based on role
        switch (role) {
          case "Admin":
            this.router.navigate(["/admin"]);
            break;
          case "Teacher":
            this.router.navigate(["/teacherlogin"]);
            break;
          case "Student":
            this.router.navigate(["/studentdashboard"]);
            break;
        }
      });
  }

  /* ==========================================================================
      LOGOUT
  ========================================================================== */
  logout(): void {
    const username = localStorage.getItem("username");

    this.http
      .post(
        this.logoutUrl,
        { username },
        { headers: this.authHeaders() }
      )
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.performLocalLogout();
      });
  }

  private performLocalLogout(): void {
    this.token = "";
    this.isAuthenticated = false;
    this.authenticatedSub.next(false);
    clearTimeout(this.logoutTimer);

    localStorage.removeItem("authToken");
    localStorage.removeItem("expiresIn");
    localStorage.removeItem("username");
    localStorage.removeItem("userRole");

    this.router.navigate(["/login"]);
  }

  /* ==========================================================================
      SIGNUP
  ========================================================================== */
  signupUser(username: string, password: string, role: string) {
    return this.http.post(this.signupUrl, { username, password, role });
  }

  /* ==========================================================================
      AUTH STATUS CHECKS
  ========================================================================== */
  getIsAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  getAuthenticatedSub(): Observable<boolean> {
    return this.authenticatedSub.asObservable();
  }

  getToken(): string {
    return localStorage.getItem("authToken") || "";
  }

  isSessionValid(): boolean {
    const exp = localStorage.getItem("expiresIn");
    return exp ? new Date(exp) > new Date() : false;
  }

  authenticateFromLocalStorage(): void {
    const token = localStorage.getItem("authToken");
    const expiresIn = localStorage.getItem("expiresIn");

    if (!token || !expiresIn) return;

    const expMs = new Date(expiresIn).getTime() - Date.now();
    if (expMs > 0) {
      this.token = token;
      this.isAuthenticated = true;
      this.authenticatedSub.next(true);
      this.startLogoutTimer(expMs);
    } else {
      this.performLocalLogout();
    }
  }

  /* ==========================================================================
      DASHBOARD ROUTES
  ========================================================================== */
  getDashboardRoute(): string {
    switch (localStorage.getItem("userRole")) {
      case "Admin":
        return "/admin";
      case "Teacher":
        return "/teacherlogin";
      case "Student":
        return "/studentdashboard";
      default:
        return "/";
    }
  }
}
