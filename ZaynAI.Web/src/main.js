"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const platform_browser_1 = require("@angular/platform-browser");
const http_1 = require("@angular/common/http");
const app_component_1 = require("./app/app.component");
const auth_interceptor_1 = require("./app/auth.interceptor");
(0, platform_browser_1.bootstrapApplication)(app_component_1.AppComponent, {
    providers: [
        (0, http_1.provideHttpClient)((0, http_1.withInterceptors)([auth_interceptor_1.authInterceptor]))
    ]
}).catch((error) => console.error(error));
//# sourceMappingURL=main.js.map