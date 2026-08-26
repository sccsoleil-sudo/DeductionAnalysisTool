/// <reference types="vite/client" />

declare module 'react-pivottable/PivotTableUI';
declare module 'react-pivottable/TableRenderers';
declare module 'react-pivottable/PlotlyRenderers';
declare module 'react-pivottable/pivottable.css';

declare module 'plotly.js-dist-min' {
  const plotly: Record<string, unknown>;
  export default plotly;
}

declare module 'react-plotly.js/factory' {
  import type { ComponentType } from 'react';
  import type { PlotParams } from 'react-plotly.js';

  export default function createPlotlyComponent(
    plotly: unknown,
  ): ComponentType<PlotParams>;
}
