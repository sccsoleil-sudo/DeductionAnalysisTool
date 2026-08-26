import { useEffect, useRef } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  DoughnutController,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { compactMoney, money } from '../lib/format';

ChartJS.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

ChartJS.defaults.font.family = "'Segoe UI', Calibri, Arial, sans-serif";
ChartJS.defaults.color = '#64748b';

export const PALETTE = {
  primary: '#1a3a5c',
  accent: '#1b8f67',
  warn: '#c98512',
  danger: '#cf4c4c',
  info: '#3b74b8',
  violet: '#7c5cbf',
  teal: '#2a9d8f',
  slate: '#94a3b8',
  lastYear: '#a8bdd4',
  thisYear: '#1a3a5c',
};

export const CATEGORY_COLORS = [
  PALETTE.primary,
  PALETTE.accent,
  PALETTE.warn,
  PALETTE.danger,
  PALETTE.info,
  PALETTE.violet,
  PALETTE.teal,
  PALETTE.slate,
];

export type AnyChartConfig =
  | ChartConfiguration<'bar'>
  | ChartConfiguration<'line'>
  | ChartConfiguration<'doughnut'>;

interface ChartProps {
  config: AnyChartConfig;
  className?: string;
}

export function Chart({ config, className = 'chart-box' }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new ChartJS(canvasRef.current, config as ChartConfiguration);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} />
    </div>
  );
}

const moneyTooltip = {
  callbacks: {
    label: (ctx: { dataset: { label?: string }; parsed: { y?: number | null; x?: number | null } | number }) => {
      const parsed = ctx.parsed;
      const raw = typeof parsed === 'number' ? parsed : (parsed.y ?? parsed.x ?? 0);
      const name = ctx.dataset.label ? `${ctx.dataset.label}: ` : '';
      return `${name}${money(raw ?? 0)}`;
    },
  },
};

/** Grouped last-year vs this-year bars, the core comparison view. */
export function comparisonConfig(
  labels: string[],
  lastYear: number[],
  thisYear: number[],
  lastYearLabel: string,
  thisYearLabel: string,
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: lastYearLabel,
          data: lastYear,
          backgroundColor: PALETTE.lastYear,
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.68,
        },
        {
          label: thisYearLabel,
          data: thisYear,
          backgroundColor: PALETTE.thisYear,
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.68,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 11, boxHeight: 11, padding: 14 } },
        tooltip: moneyTooltip,
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: '#eef2f7' },
          ticks: { callback: (v) => compactMoney(Number(v)) },
        },
      },
    },
  };
}

export function stackedBarConfig(
  labels: string[],
  datasets: { label: string; data: number[]; color: string }[],
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.color,
        borderRadius: 3,
        barPercentage: 0.72,
        categoryPercentage: 0.68,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 11, boxHeight: 11, padding: 14 } },
        tooltip: moneyTooltip,
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: '#eef2f7' },
          ticks: { callback: (v) => compactMoney(Number(v)) },
        },
      },
    },
  };
}

export function horizontalBarConfig(
  labels: string[],
  values: number[],
  colors: string[] = CATEGORY_COLORS,
): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Amount',
          data: values,
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          borderRadius: 4,
          barPercentage: 0.78,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: moneyTooltip },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#eef2f7' },
          ticks: { callback: (v) => compactMoney(Number(v)) },
        },
        y: { grid: { display: false } },
      },
    },
  };
}

export function doughnutConfig(
  labels: string[],
  values: number[],
  colors: string[] = CATEGORY_COLORS,
): ChartConfiguration<'doughnut'> {
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 11, boxHeight: 11, padding: 12 } },
        tooltip: moneyTooltip,
      },
    },
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthlyConfig(
  lastYear: number[],
  thisYear: number[],
  lastYearLabel: string,
  thisYearLabel: string,
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [
        {
          label: lastYearLabel,
          data: lastYear,
          borderColor: PALETTE.lastYear,
          backgroundColor: 'rgba(168,189,212,0.18)',
          fill: true,
          tension: 0.32,
          pointRadius: 2.5,
          borderWidth: 2,
        },
        {
          label: thisYearLabel,
          data: thisYear,
          borderColor: PALETTE.primary,
          backgroundColor: 'rgba(26,58,92,0.10)',
          fill: true,
          tension: 0.32,
          pointRadius: 2.5,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 11, boxHeight: 11, padding: 14 } },
        tooltip: moneyTooltip,
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: '#eef2f7' },
          ticks: { callback: (v) => compactMoney(Number(v)) },
        },
      },
    },
  };
}
