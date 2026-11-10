import { Component, inject } from '@angular/core';
import { ActionSheetController, NavController } from '@ionic/angular/lazy';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  private readonly sheets = inject(ActionSheetController);
  private readonly nav = inject(NavController);

  async openReport(): Promise<void> {
    const sheet = await this.sheets.create({
      header: 'What do you want to report?',
      buttons: [
        { text: 'Report Lost Item', icon: 'help-circle', handler: () => void this.nav.navigateForward('/report/lost') },
        { text: 'Report Found Item', icon: 'camera', handler: () => void this.nav.navigateForward('/report/found') },
        { text: 'Cancel', role: 'cancel', icon: 'close' },
      ],
    });
    await sheet.present();
  }
}
