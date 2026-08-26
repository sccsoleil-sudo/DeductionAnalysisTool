import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import createPlotlyRenderers from 'react-pivottable/PlotlyRenderers';
import TableRenderers from 'react-pivottable/TableRenderers';

// plotly.js-dist-min typing is loose; runtime default export is the Plotly namespace.
const plotly = Plotly as unknown as Parameters<typeof createPlotlyComponent>[0];
const Plot = createPlotlyComponent(plotly);
const PlotlyRenderers = createPlotlyRenderers(Plot);

export const PIVOT_RENDERERS = Object.assign({}, TableRenderers, PlotlyRenderers);
