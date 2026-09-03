import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { RouterOutlet } from '@angular/router';
import { ApiService } from './api.service';
import { AuthComponent } from './auth/auth.component';
import { SubscriptionComponent } from './subscription/subscription.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AuthComponent, SubscriptionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly user = this.api.currentUser;
  readonly showAuthModal = signal(false);

  openAuthModal() { this.showAuthModal.set(true); }
  closeAuthModal() { this.showAuthModal.set(false); }

  readonly features = [
    {
      title: 'AI Code Review',
      desc: 'Instant, context-aware analysis with security, performance, and correctness findings.',
      icon: '<path d="M10 2l2.4 4.8 5.3.8-3.85 3.75.91 5.3L10 14.1l-4.76 2.55.91-5.3L2.3 7.6l5.3-.8L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
      color: 'purple'
    },
    {
      title: 'Workspace Analysis',
      desc: 'Deep scan your entire codebase for architecture issues, patterns, and improvements.',
      icon: '<rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>',
      color: 'blue'
    },
    {
      title: 'Test Generation',
      desc: 'Auto-generate unit and integration tests that match your existing test framework.',
      icon: '<path d="M4 10h12M10 4v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>',
      color: 'green'
    },
    {
      title: 'Security Scanning',
      desc: 'OWASP Top 10 detection, secrets exposure checks, and dependency vulnerability analysis.',
      icon: '<path d="M10 2l6 3v5c0 3.5-2.5 6.5-6 7.5C4.5 16.5 2 13.5 2 10V5l8-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
      color: 'red'
    },
    {
      title: 'Smart Debugging',
      desc: 'Root cause analysis with step-by-step fix suggestions and prevention strategies.',
      icon: '<circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      color: 'amber'
    },
    {
      title: 'Team Collaboration',
      desc: 'Share AI insights, reviews, and automated workflows across your entire engineering team.',
      icon: '<circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M1 17c0-2.76 2.69-5 6-5M8 17c0-2.76 2.69-5 6-5s6 2.24 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
      color: 'teal'
    }
  ];

  ngOnInit() {
    this.api.restoreSession();
  }
}
