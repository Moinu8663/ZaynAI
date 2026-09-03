import { HttpInterceptorFn } from '@angular/common/http';

const tokenKey = 'zaynai-token';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = localStorage.getItem(tokenKey);
  if (!token) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
