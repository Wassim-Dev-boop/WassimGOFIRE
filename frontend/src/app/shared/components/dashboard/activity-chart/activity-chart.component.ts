import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexPlotOptions, ApexDataLabels, ApexStroke, ApexLegend, ApexYAxis, ApexGrid, ApexFill, ApexTooltip } from 'ng-apexcharts';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../ui/dropdown/dropdown-item/dropdown-item.component';

@Component({
  selector: 'app-activity-chart',
  standalone: true,
  imports: [
    NgApexchartsModule,
    DropdownComponent,
    DropdownItemComponent
],
  templateUrl: './activity-chart.component.html'
})
export class ActivityChartComponent {
  @Input() title = "Flux d'activite mensuel";
  @Input() seriesName = 'Activite';
  @Input() seriesData: number[] | null = null;
  @Input() categories: string[] | null = null;

  private readonly defaultCategories = [
    'Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  private readonly defaultSeriesData = [168, 385, 201, 298, 187, 195, 291, 110, 215, 390, 280, 112];

  public series: ApexAxisChartSeries = [
    {
      name: 'Activite',
      data: [168, 385, 201, 298, 187, 195, 291, 110, 215, 390, 280, 112],
    },
  ];
  public chart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'bar',
    height: 180,
    toolbar: { show: false },
  };
  public xaxis: ApexXAxis = {
    categories: [...this.defaultCategories],
    axisBorder: { show: false },
    axisTicks: { show: false },
  };
  public plotOptions: ApexPlotOptions = {
    bar: {
      horizontal: false,
      columnWidth: '39%',
      borderRadius: 5,
      borderRadiusApplication: 'end',
    },
  };
  public dataLabels: ApexDataLabels = { enabled: false };
  public stroke: ApexStroke = {
    show: true,
    width: 4,
    colors: ['transparent'],
  };
  public legend: ApexLegend = {
    show: false,
    position: 'top',
    horizontalAlign: 'left',
    fontFamily: 'Outfit',
  };
  public yaxis: ApexYAxis = {
    title: { text: undefined },
    min: 0,
    max: 400,
    tickAmount: 4,
    labels: {
      style: {
        fontSize: '12px',
        colors: ['#6B7280'],
      },
    },
  };
  public grid: ApexGrid = { yaxis: { lines: { show: true } } };
  public fill: ApexFill = { opacity: 1 };
  public tooltip: ApexTooltip = {
    x: { show: false },
    y: { formatter: (val: number) => `${val}` },
  };
  public colors: string[] = ['#465fff'];

  isOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['seriesData'] || changes['categories'] || changes['seriesName']) {
      this.applyChartPayload();
    }
  }

  constructor() {
    this.applyChartPayload();
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  private applyChartPayload(): void {
    const chartCategories = this.resolveCategories();
    const chartData = this.resolveData(chartCategories.length);

    this.series = [
      {
        name: this.seriesName || 'Activite',
        data: chartData,
      },
    ];

    this.xaxis = {
      ...this.xaxis,
      categories: chartCategories,
    };

    const maxValue = Math.max(...chartData, 0);
    const roundedMax = this.resolveYAxisMax(maxValue);

    this.yaxis = {
      ...this.yaxis,
      min: 0,
      max: roundedMax,
      tickAmount: 4,
    };
  }

  private resolveYAxisMax(maxValue: number): number {
    if (maxValue <= 0) {
      return 10;
    }

    if (maxValue <= 10) {
      return 10;
    }

    if (maxValue <= 50) {
      return Math.ceil(maxValue / 5) * 5;
    }

    if (maxValue <= 200) {
      return Math.ceil(maxValue / 10) * 10;
    }

    return Math.ceil(maxValue / 50) * 50;
  }

  private resolveCategories(): string[] {
    if (this.categories && this.categories.length > 0) {
      return [...this.categories];
    }

    return [...this.defaultCategories];
  }

  private resolveData(expectedLength: number): number[] {
    if (!this.seriesData || this.seriesData.length === 0) {
      return [...this.defaultSeriesData];
    }

    if (this.seriesData.length === expectedLength) {
      return [...this.seriesData];
    }

    const normalized = [...this.seriesData];
    while (normalized.length < expectedLength) {
      normalized.push(0);
    }

    return normalized.slice(0, expectedLength);
  }
}
