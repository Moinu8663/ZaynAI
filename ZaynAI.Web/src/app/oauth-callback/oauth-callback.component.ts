import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="callback-wrap">
      @if (error()) {
        <div class="cb-error">
          <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4M10 13.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <div>
            <strong>Sign-in failed</strong>
            <p>{{ errorMessage() }}</p>
            <button (click)="goBack()">Try again</button>
          </div>
        </div>
      } @else {
        <div class="cb-loading">
          <span class="spinner"></span>
          <span>Completing sign-in…</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .callback-wrap {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--bg);
    }
    .cb-loading {
      display: flex; align-items: center; gap: 12px;
      color: var(--text-muted); font-size: 0.9rem;
    }
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid rgba(99,102,241,0.3); border-top-color: #6366f1;
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .cb-error {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 24px 28px; max-width: 420px;
      background: var(--surface); border: 1px solid rgba(239,68,68,0.25);
      border-radius: 16px;
    }
    .cb-error svg { width: 22px; height: 22px; color: #f87171; flex-shrink: 0; margin-top: 2px; }
    .cb-error strong { display: block; color: var(--text-primary); margin-bottom: 4px; }
    .cb-error p { margin: 0 0 12px; color: var(--text-muted); font-size: 0.875rem; }
    .cb-error button {
      padding: 7px 18px; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; border: none; font: inherit; font-size: 0.875rem;
      font-weight: 600; cursor: pointer;
    }
  `]
})
export class OAuthCallbackComponent implements OnInit {
  private readonly api = inject(ApiService);

  error = () => this._error;
  errorMessage = () => this._errorMsg;
  private _error = false;
  private _errorMsg = '';

  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const err    = params.get('error');

    if (err) {
      this._error = true;
      this._errorMsg = this.friendlyError(err);
      return;
    }

    if (!token) {
      this._error = true;
      this._errorMsg = 'No token received from the sign-in provider.';
      return;
    }

    // Exchange token for user profile then redirect to dashboard
    this.api.restoreSessionFromToken(token).then(ok => {
      if (ok) {
        window.location.href = '/';
      } else {
        this._error = true;
        this._errorMsg = 'Could not verify your account. Please try again.';
      }
    });
  }

  goBack() { window.location.href = '/'; }

  private friendlyError(code: string): string {
    const map: Record<string, string> = {
      access_denied:       'You cancelled the sign-in. Please try again.',
      missing_code:        'The sign-in provider did not return an authorization code.',
      account_error:       'Could not create or retrieve your account. Please contact support.',
      unsupported_provider:'This sign-in provider is not supported.',
    };
    return map[code] ?? `Sign-in error: ${code.replace(/_/g, ' ')}.`;
  }
}
