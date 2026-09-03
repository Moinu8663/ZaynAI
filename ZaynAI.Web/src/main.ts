import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { OAuthCallbackComponent } from './app/oauth-callback/oauth-callback.component';
import { authInterceptor } from './app/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter([
      { path: 'auth/callback', component: OAuthCallbackComponent },
      { path: '**', component: AppComponent }
    ])
  ]
}).catch((error) => console.error(error));
