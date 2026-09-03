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
exports.ApiService = void 0;
const core_1 = require("@angular/core");
const rxjs_1 = require("rxjs");
const tokenKey = 'ai-dev-assistant-token';
let ApiService = (() => {
    let _classDecorators = [(0, core_1.Injectable)({ providedIn: 'root' })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ApiService = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            ApiService = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        http;
        baseUrl = 'http://localhost:5206/api';
        currentUser = (0, core_1.signal)(null);
        constructor(http) {
            this.http = http;
        }
        get token() {
            return localStorage.getItem(tokenKey);
        }
        loadPlans() {
            return this.http.get(`${this.baseUrl}/plans`);
        }
        restoreSession() {
            if (!this.token) {
                return;
            }
            this.http.get(`${this.baseUrl}/me`).subscribe({
                next: (user) => this.currentUser.set(user),
                error: () => this.signOut()
            });
        }
        signUp(name, email, password, planId) {
            return this.http.post(`${this.baseUrl}/auth/signup`, { name, email, password, planId }).pipe((0, rxjs_1.tap)((response) => this.saveSession(response)));
        }
        signIn(email, password) {
            return this.http.post(`${this.baseUrl}/auth/signin`, { email, password }).pipe((0, rxjs_1.tap)((response) => this.saveSession(response)));
        }
        changeSubscription(planId) {
            return this.http.put(`${this.baseUrl}/subscription`, { planId }).pipe((0, rxjs_1.tap)((user) => this.currentUser.set(user)));
        }
        cancelSubscription() {
            return this.http.post(`${this.baseUrl}/subscription/cancel`, {}).pipe((0, rxjs_1.tap)((user) => this.currentUser.set(user)));
        }
        signOut() {
            localStorage.removeItem(tokenKey);
            this.currentUser.set(null);
        }
        saveSession(response) {
            localStorage.setItem(tokenKey, response.token);
            this.currentUser.set(response.user);
        }
    };
    return ApiService = _classThis;
})();
exports.ApiService = ApiService;
//# sourceMappingURL=api.service.js.map