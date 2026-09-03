import { CurrencyPipe, DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService, SubscriptionPlan, UsageSummary } from '../api.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, NgClass],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.css'
})
export class SubscriptionComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly plans   = signal<SubscriptionPlan[]>([]);
  readonly loading = signal(false);
  readonly message = signal('');
  readonly messageType = signal<'success' | 'error'>('success');
  readonly user    = this.api.currentUser;
  readonly usage   = signal<UsageSummary | null>(null);

  ngOnInit() {
    this.api.loadPlans().subscribe({ next: (p) => this.plans.set(p) });
    this.loadUsage();
  }

  private loadUsage() {
    this.api.getUsage().subscribe({
      next: (u: UsageSummary) => this.usage.set(u),
      error: () => {}
    });
  }

  isCurrentPlan(plan: SubscriptionPlan): boolean {
    return this.user()?.subscription?.planId === plan.id;
  }

  getUsagePct(used: number, limit: number): number {
    if (!limit) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  selectPlan(planId: string) {
    this.loading.set(true);
    this.message.set('');
    this.api.changeSubscription(planId).subscribe({
      next: () => {
        this.loading.set(false);
        this.messageType.set('success');
        this.message.set('Subscription updated successfully.');
        this.loadUsage();
      },
      error: (err) => {
        this.loading.set(false);
        this.messageType.set('error');
        this.message.set(err.error?.message ?? 'Could not update subscription. Please try again.');
      }
    });
  }

  cancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    this.loading.set(true);
    this.message.set('');
    this.api.cancelSubscription().subscribe({
      next: () => {
        this.loading.set(false);
        this.messageType.set('success');
        this.message.set('Subscription canceled. You retain access until the end of the billing period.');
      },
      error: () => {
        this.loading.set(false);
        this.messageType.set('error');
        this.message.set('Could not cancel subscription. Please try again or contact support.');
      }
    });
  }

  signOut() { this.api.signOut(); }

  get isCanceled(): boolean {
    return this.user()?.subscription?.status === 'Canceled';
  }
}
