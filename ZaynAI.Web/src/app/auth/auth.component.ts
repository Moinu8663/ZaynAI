import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, SubscriptionPlan } from '../api.service';

type AuthMode = 'signin' | 'signup';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly closed = output<void>();

  readonly mode = signal<AuthMode>('signup');
  readonly loading = signal(false);
  readonly socialLoading = signal<string | null>(null);
  readonly message = signal('');
  readonly messageType = signal<'success' | 'error'>('error');
  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly showPassword = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});

  form = { name: '', email: '', password: '', planId: '' };

  ngOnInit() {
    this.api.loadPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        if (plans.length) this.form.planId = plans[0].id;
      },
      error: () => this.message.set('Could not load plans. Please check your connection.')
    });
  }

  setMode(m: AuthMode) {
    this.mode.set(m);
    this.message.set('');
    this.fieldErrors.set({});
  }

  validate(): boolean {
    const errors: Record<string, string> = {};
    if (this.mode() === 'signup') {
      if (!this.form.name.trim()) errors['name'] = 'Full name is required.';
      else if (this.form.name.trim().length < 2) errors['name'] = 'Name must be at least 2 characters.';
    }
    if (!this.form.email.trim()) {
      errors['email'] = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      errors['email'] = 'Please enter a valid email address.';
    }
    if (!this.form.password) {
      errors['password'] = 'Password is required.';
    } else if (this.form.password.length < 8) {
      errors['password'] = 'Password must be at least 8 characters.';
    }
    if (this.mode() === 'signup' && !this.form.planId) {
      errors['plan'] = 'Please select a plan.';
    }
    this.fieldErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  submit() {
    if (!this.validate()) return;
    this.message.set('');
    this.loading.set(true);

    const req = this.mode() === 'signup'
      ? this.api.signUp(this.form.name, this.form.email, this.form.password, this.form.planId)
      : this.api.signIn(this.form.email, this.form.password);

    req.subscribe({
      next: () => {
        this.loading.set(false);
        this.messageType.set('success');
        this.message.set(this.mode() === 'signup' ? 'Account created! Welcome to ZaynAI.' : 'Welcome back!');
        setTimeout(() => this.closed.emit(), 800);
      },
      error: (err) => {
        this.loading.set(false);
        this.messageType.set('error');
        const status = err.status;
        if (status === 409) this.message.set('An account with this email already exists. Try signing in.');
        else if (status === 401) this.message.set('Incorrect email or password. Please try again.');
        else if (status === 400) this.message.set(err.error?.message ?? 'Please check your details and try again.');
        else if (status === 0) this.message.set('Cannot connect to server. Please check your connection.');
        else this.message.set(err.error?.message ?? 'Authentication failed. Please try again.');
      }
    });
  }

  signInWithGoogle() {
    this.socialLoading.set('google');
    this.api.signInWithOAuth('google').finally(() => this.socialLoading.set(null));
  }

  signInWithGitHub() {
    this.socialLoading.set('github');
    this.api.signInWithOAuth('github').finally(() => this.socialLoading.set(null));
  }

  signInWithMicrosoft() {
    this.socialLoading.set('microsoft');
    this.api.signInWithOAuth('microsoft').finally(() => this.socialLoading.set(null));
  }

  getFieldError(field: string): string {
    return this.fieldErrors()[field] ?? '';
  }

  clearFieldError(field: string) {
    const current = { ...this.fieldErrors() };
    delete current[field];
    this.fieldErrors.set(current);
  }

  get passwordStrength(): { level: number; label: string; color: string } {
    const p = this.form.password;
    if (!p) return { level: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 3) return { level: 2, label: 'Fair', color: '#f59e0b' };
    if (score === 4) return { level: 3, label: 'Good', color: '#10b981' };
    return { level: 4, label: 'Strong', color: '#6366f1' };
  }
}
