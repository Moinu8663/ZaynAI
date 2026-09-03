"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authInterceptor = void 0;
const tokenKey = 'ai-dev-assistant-token';
const authInterceptor = (request, next) => {
    const token = localStorage.getItem(tokenKey);
    if (!token) {
        return next(request);
    }
    return next(request.clone({
        setHeaders: {
            Authorization: `Bearer ${token}`
        }
    }));
};
exports.authInterceptor = authInterceptor;
//# sourceMappingURL=auth.interceptor.js.map