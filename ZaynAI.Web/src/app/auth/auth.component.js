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
exports.AuthComponent = void 0;
const common_1 = require("@angular/common");
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const api_service_1 = require("../api.service");
let AuthComponent = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-auth',
            standalone: true,
            imports: [common_1.CommonModule, forms_1.FormsModule],
            templateUrl: './auth.component.html',
            styleUrl: './auth.component.css'
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var AuthComponent = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AuthComponent = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        api = (0, core_1.inject)(api_service_1.ApiService);
        mode = (0, core_1.signal)('signup');
        loading = (0, core_1.signal)(false);
        message = (0, core_1.signal)('');
        messageType = (0, core_1.signal)('error');
        plans = (0, core_1.signal)([]);
        showPassword = (0, core_1.signal)(false);
        form = { name: '', email: '', password: '', planId: '' };
        ngOnInit() {
            this.api.loadPlans().subscribe({
                next: (plans) => {
                    this.plans.set(plans);
                    if (plans.length)
                        this.form.planId = plans[0].id;
                }
            });
        }
        submit() {
            this.message.set('');
            this.loading.set(true);
            const req = this.mode() === 'signup'
                ? this.api.signUp(this.form.name, this.form.email, this.form.password, this.form.planId)
                : this.api.signIn(this.form.email, this.form.password);
            req.subscribe({
                next: () => {
                    this.loading.set(false);
                    this.messageType.set('success');
                    this.message.set(this.mode() === 'signup' ? 'Account created successfully!' : 'Welcome back!');
                },
                error: (err) => {
                    this.loading.set(false);
                    this.messageType.set('error');
                    this.message.set(err.error?.message ?? 'Authentication failed. Please try again.');
                }
            });
        }
        setMode(m) {
            this.mode.set(m);
            this.message.set('');
        }
    };
    return AuthComponent = _classThis;
})();
exports.AuthComponent = AuthComponent;
//# sourceMappingURL=auth.component.js.map