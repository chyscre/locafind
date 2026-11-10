import { Component, inject } from '@angular/core';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor() {
    // Check the saved login with the server (logs out if it expired; keeps it if offline).
    void inject(AuthService).refresh();
  }
}
