import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { formatDistance } from '../core/geo';
import { CATEGORY_ICON, CATEGORY_LABEL, CUSTODY_LABEL, ReportType } from '../core/report.model';
import { ReportService } from '../core/report.service';

type Filter = 'all' | ReportType;

/** List view of every active report. Basic details show even when the user is far away. */
@Component({
  selector: 'app-browse',
  templateUrl: 'browse.page.html',
  styleUrls: ['browse.page.scss'],
  standalone: false,
})
export class BrowsePage implements OnInit {
  readonly reports = inject(ReportService);
  readonly query = signal('');
  readonly filter = signal<Filter>('all');

  readonly icon = CATEGORY_ICON;
  readonly categoryLabel = CATEGORY_LABEL;
  readonly custodyLabel = CUSTODY_LABEL;
  readonly formatDistance = formatDistance;

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.reports.views().filter(({ report }) => {
      if (f !== 'all' && report.type !== f) return false;
      if (!q) return true;
      return `${report.name} ${report.description} ${CATEGORY_LABEL[report.category]}`.toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.ionViewWillEnter();
  }

  ionViewWillEnter(): void {
    if (!this.reports.reports().length) void this.reports.load();
  }

  setFilter(value: unknown): void {
    if (value === 'all' || value === 'lost' || value === 'found') this.filter.set(value);
  }
}
