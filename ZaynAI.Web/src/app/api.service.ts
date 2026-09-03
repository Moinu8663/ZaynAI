import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../environments/environment';

const tokenKey = 'zaynai-token';

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  monthlyAssistantRequests: number;
  workspaceScans: number;
  features: string[];
}

export interface Subscription {
  planId: string;
  planName: string;
  monthlyPrice: number;
  status: string;
  startedAt: string;
  renewsAt: string | null;
  canceledAt: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  subscription: Subscription;
  createdAt: string;
  lastSignedInAt: string | null;
}

export interface UsageSummary {
  planId: string;
  planName: string;
  geminiModel: string;
  allowCodeChanges: boolean;
  allowWorkspaceScan: boolean;
  assistantRequestsUsed: number;
  assistantRequestsLimit: number;
  workspaceScansUsed: number;
  workspaceScansLimit: number;
}

interface AuthResponse { token: string; user: User; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  readonly currentUser = signal<User | null>(null);

  constructor(private readonly http: HttpClient) {}

  get token(): string | null { return localStorage.getItem(tokenKey); }

  loadPlans() {
    return this.http.get<SubscriptionPlan[]>(`${this.baseUrl}/plans`);
  }

  restoreSession() {
    if (!this.token) return;
    this.http.get<User>(`${this.baseUrl}/me`).subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.signOut()
    });
  }

  async restoreSessionFromToken(token: string): Promise<boolean> {
    localStorage.setItem(tokenKey, token);
    return new Promise(resolve => {
      this.http.get<User>(`${this.baseUrl}/me`).subscribe({
        next: (user) => { this.currentUser.set(user); resolve(true); },
        error: () => { this.signOut(); resolve(false); }
      });
    });
  }

  signUp(name: string, email: string, password: string, planId: string) {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/signup`, { name, email, password, planId }).pipe(
      tap((r) => this.saveSession(r))
    );
  }

  signIn(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/signin`, { email, password }).pipe(
      tap((r) => this.saveSession(r))
    );
  }

  /**
   * OAuth social login — redirects to the backend OAuth flow.
   * The backend should redirect back with a token on success.
   * provider: 'google' | 'github' | 'microsoft'
   */
  async signInWithOAuth(provider: 'google' | 'github' | 'microsoft'): Promise<void> {
    const redirectUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${this.baseUrl}/auth/oauth/${provider}?redirect=${redirectUrl}`;
  }

  /**
   * Called by the OAuth callback page to exchange the code for a session.
   */
  handleOAuthCallback(token: string, user: User): void {
    this.saveSession({ token, user });
  }

  changeSubscription(planId: string) {
    return this.http.put<User>(`${this.baseUrl}/subscription`, { planId }).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  cancelSubscription() {
    return this.http.post<User>(`${this.baseUrl}/subscription/cancel`, {}).pipe(
      tap((user) => this.currentUser.set(user))
    );
  }

  getUsage() {
    return this.http.get<UsageSummary>(`${this.baseUrl}/usage`);
  }

  signOut() {
    localStorage.removeItem(tokenKey);
    this.currentUser.set(null);
  }

  private saveSession(response: AuthResponse) {
    localStorage.setItem(tokenKey, response.token);
    this.currentUser.set(response.user);
  }
}
