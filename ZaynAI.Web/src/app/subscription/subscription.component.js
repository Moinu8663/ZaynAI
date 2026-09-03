"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionComponent = void 0;
const common_1 = require("@angular/common");
const core_1 = require("@angular/core");
const api_service_1 = require("../api.service");
let SubscriptionComponent = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-subscription',
            standalone: true,
            imports: [common_1.CurrencyPipe, common_1.DatePipe, common_1.DecimalPipe, common_1.NgClass],
            templateUrl: './subscription.component.html',
            styleUrl: './subscription.component.css'
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var SubscriptionComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            SubscriptionComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        api = (0, core_1.inject)(api_service_1.ApiService);
        plans = (0, core_1.signal)([]);
        loading = (0, core_1.signal)(false);
        message = (0, core_1.signal)('');
        messageType = (0, core_1.signal)('success');
        user = this.api.currentUser;
        ngOnInit() {
            this.api.loadPlans().subscribe({ next: (p) => this.plans.set(p) });
        }
        isCurrentPlan(plan) {
            return this.user()?.subscription?.planId === plan.id;
        }
        selectPlan(planId) {
            this.loading.set(true);
            this.message.set('');
            this.api.changeSubscription(planId).subscribe({
                next: () => { this.loading.set(false); this.messageType.set('success'); this.message.set('Subscription updated successfully.'); },
                error: (err) => { this.loading.set(false); this.messageType.set('error'); this.message.set(err.error?.message ?? 'Could not update subscription.'); }
            });
        }
        cancelSubscription() {
            this.loading.set(true);
            this.message.set('');
            this.api.cancelSubscription().subscribe({
                next: () => { this.loading.set(false); this.messageType.set('success'); this.message.set('Subscription canceled.'); },
                error: () => { this.loading.set(false); this.messageType.set('error'); this.message.set('Could not cancel subscription.'); }
            });
        }
        signOut() {
            this.api.signOut();
        }
        get isCanceled() {
            return this.user()?.subscription?.status === 'Canceled';
        }
    };
    return SubscriptionComponent = _classThis;
})();
exports.SubscriptionComponent = SubscriptionComponent;
//# sourceMappingURL=subscription.component.js.map