import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, SubscriptionPlan } from '../api.service';

type Step = 'form' | 'confirm' | 'success';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css'
})
export class PaymentComponent implements OnInit {
  @Input() plan!: SubscriptionPlan;
  @Output() closed = new EventEmitter<void>();
  @Output() paid   = new EventEmitter<void>();

  private readonly api = inject(ApiService);

  readonly step    = signal<Step>('form');
  readonly loading = signal(false);
  readonly error   = signal('');

  card = { name: '', number: '', expiry: '', cvv: '' };
  fieldErrors: Record<string, string> = {};

  ngOnInit() {}

  formatCardNumber(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').slice(0, 16);
    this.card.number = v.replace(/(.{4})/g, '$1 ').trim();
  }

  formatExpiry(e: Event) {
    const input = e.target as HTMLInputElement;
    let v = input.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    this.card.expiry = v;
  }

  get cardBrand(): string {
    const n = this.card.number.replace(/\s/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'Amex';
    return '';
  }

  validate(): boolean {
    const e: Record<string, string> = {};
    if (!this.card.name.trim()) e['name'] = 'Cardholder name is required.';
    const digits = this.card.number.replace(/\s/g, '');
    if (digits.length < 13) e['number'] = 'Enter a valid card number.';
    if (!/^\d{2}\/\d{2}$/.test(this.card.expiry)) e['expiry'] = 'Enter expiry as MM/YY.';
    else {
      const [mm, yy] = this.card.expiry.split('/').map(Number);
      const now = new Date();
      const exp = new Date(2000 + yy, mm - 1);
      if (mm < 1 || mm > 12 || exp < now) e['expiry'] = 'Card has expired.';
    }
    if (this.card.cvv.length < 3) e['cvv'] = 'Enter a valid CVV.';
    this.fieldErrors = e;
    return Object.keys(e).length === 0;
  }

  review() {
    if (this.validate()) this.step.set('confirm');
  }

  back() { this.step.set('form'); }

  confirm() {
    this.loading.set(true);
    this.error.set('');
    this.api.changeSubscription(this.plan.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('success');
        setTimeout(() => this.paid.emit(), 1800);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Payment failed. Please try again.');
        this.step.set('form');
      }
    });
  }
}
