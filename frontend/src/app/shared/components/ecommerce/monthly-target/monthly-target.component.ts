import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApexNonAxisChartSeries,
  ApexChart,
  ApexPlotOptions,
  ApexFill,
  ApexStroke,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../ui/dropdown/dropdown-item/dropdown-item.component';

@Component({
  selector: 'app-monthly-target',
  imports: [
    CommonModule,
    NgApexchartsModule,
    DropdownComponent,
    DropdownItemComponent
],
  templateUrl: './monthly-target.component.html',
})
export class MonthlyTargetComponent {
  @Input() title = 'Monthly Target';
  @Input() subtitle = 'Target you\'ve set for each month';
  @Input() progress = 75.55;
  @Input() deltaPercent = 10;
  @Input() summaryText = 'You earn $3287 today, it\'s higher than last month. Keep up your good work!';
  @Input() targetLabel = 'Target';
  @Input() revenueLabel = 'Revenue';
  @Input() todayLabel = 'Today';
  @Input() valueFormat: 'currency' | 'number' = 'currency';
  @Input() valuePrefix = '$';

  @Input() targetValue = 20000;
  @Input() revenueValue = 20000;
  @Input() todayValue = 20000;

  @Input() targetTrend: 'up' | 'down' = 'down';
  @Input() revenueTrend: 'up' | 'down' = 'up';
  @Input() todayTrend: 'up' | 'down' = 'up';

  public series: ApexNonAxisChartSeries = [75.55];
  public chart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'radialBar',
    height: 330,
    sparkline: { enabled: true },
  };
  public plotOptions: ApexPlotOptions = {
    radialBar: {
      startAngle: -85,
      endAngle: 85,
      hollow: { size: '80%' },
      track: {
        background: '#E4E7EC',
        strokeWidth: '100%',
        margin: 5,
      },
      dataLabels: {
        name: { show: false },
        value: {
          fontSize: '36px',
          fontWeight: '600',
          offsetY: -40,
          color: '#1D2939',
          formatter: (val: number) => `${val.toFixed(2)}%`,
        },
      },
    },
  };
  public fill: ApexFill = {
    type: 'solid',
    colors: ['#465FFF'],
  };
  public stroke: ApexStroke = {
    lineCap: 'round',
  };
  public labels: string[] = ['Progress'];
  public colors: string[] = ['#465FFF'];

  isOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['progress']) {
      this.applyProgress();
    }
  }

  constructor() {
    this.applyProgress();
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  get deltaLabel(): string {
    const prefix = this.deltaPercent >= 0 ? '+' : '';
    return `${prefix}${this.deltaPercent.toFixed(0)}%`;
  }

  get deltaToneClass(): string {
    return this.deltaPercent >= 0
      ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
      : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400';
  }

  get formattedTargetValue(): string {
    return this.formatCompactValue(this.targetValue);
  }

  get formattedRevenueValue(): string {
    return this.formatCompactValue(this.revenueValue);
  }

  get formattedTodayValue(): string {
    return this.formatCompactValue(this.todayValue);
  }

  isTrendUp(direction: 'up' | 'down'): boolean {
    return direction === 'up';
  }

  private applyProgress(): void {
    const normalized = Number.isFinite(this.progress) ? this.progress : 0;
    const clamped = Math.min(100, Math.max(0, normalized));
    this.series = [Number(clamped.toFixed(2))];
  }

  private formatCompactValue(value: number): string {
    if (!Number.isFinite(value)) {
      return this.valueFormat === 'currency' ? `${this.valuePrefix}0` : '0';
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1000) {
      const compact =
        absValue >= 10000
          ? `${Math.round(absValue / 1000)}`
          : `${Math.round((absValue / 1000) * 10) / 10}`;

      if (this.valueFormat === 'currency') {
        return `${sign}${this.valuePrefix}${compact}K`;
      }

      return `${sign}${compact}K`;
    }

    const rounded = `${Math.round(absValue).toLocaleString('en-US')}`;
    if (this.valueFormat === 'currency') {
      return `${sign}${this.valuePrefix}${rounded}`;
    }

    return `${sign}${rounded}`;
  }
}
