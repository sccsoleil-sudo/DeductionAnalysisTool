import Plotly from 'plotly.js-dist-min';
import type { StoredPivotConfig } from './customBlocks';
import { isPlotlyRenderer, resolveSegmentColor } from './pivotSegments';

type PlotlyFigure = {
  data: Array<Record<string, unknown> & { type?: string; name?: string; labels?: string[]; x?: unknown[]; y?: unknown[] }>;
};

export function applySegmentColors(
  graphDiv: HTMLElement,
  figure: PlotlyFigure,
  segmentColors: Record<string, string>,
): void {
  const plotly = Plotly as unknown as {
    restyle: (
      root: HTMLElement,
      update: Record<string, unknown>,
      indices: number[],
    ) => void;
  };

  figure.data.forEach((trace, traceIndex) => {
    if (trace.type === 'pie') {
      const labels = (trace.labels ?? []).map(String);
      const colors = labels.map((label, index) =>
        resolveSegmentColor(segmentColors, label, index),
      );
      plotly.restyle(graphDiv, { 'marker.colors': [colors] }, [traceIndex]);
      return;
    }

    if (trace.type === 'bar') {
      if (figure.data.length > 1) {
        const label = trace.name ?? `Series ${traceIndex + 1}`;
        plotly.restyle(
          graphDiv,
          { 'marker.color': resolveSegmentColor(segmentColors, String(label), traceIndex) },
          [traceIndex],
        );
        return;
      }

      const categories = (trace.x ?? trace.y ?? []).map(String);
      const colors = categories.map((label, index) =>
        resolveSegmentColor(segmentColors, label, index),
      );
      plotly.restyle(graphDiv, { 'marker.color': [colors] }, [traceIndex]);
      return;
    }

    const label = trace.name ?? `Series ${traceIndex + 1}`;
    plotly.restyle(
      graphDiv,
      {
        'marker.color': resolveSegmentColor(segmentColors, String(label), traceIndex),
        'line.color': resolveSegmentColor(segmentColors, String(label), traceIndex),
      },
      [traceIndex],
    );
  });
}

export async function downloadPivotChartPng(
  graphDiv: HTMLElement | null,
  filename: string,
  pivot: StoredPivotConfig,
): Promise<boolean> {
  if (!graphDiv || !isPlotlyRenderer(pivot.rendererName)) return false;

  const plotly = Plotly as unknown as {
    downloadImage: (
      root: HTMLElement,
      options: { format: string; width: number; height: number; filename: string },
    ) => Promise<void>;
  };

  const base = filename.replace(/\.(png|xlsx)$/i, '');
  await plotly.downloadImage(graphDiv, {
    format: 'png',
    width: 1280,
    height: 720,
    filename: base,
  });
  return true;
}
