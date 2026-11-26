import type { PanelDef } from './types'
import { PKT_COMMIT } from './common'
import ModelFit from './protwise/ModelFit.svelte'

const pw = (file: string, fn: string, line: number) => ({ file, fn, line, commit: PKT_COMMIT })
const TRAJ = { table: 'trajectories', columns: ['layer', 'protein', 'state', 'time', 'value_obs', 'value_pred', 'sample_id'] }

export const PANELS: PanelDef[] = [
  {
    id: 'pw-model-fit', title: 'Model fit', workflow: 'protwise', section: 'Fit', requires: [TRAJ], minSchema: '1.0',
    parity: pw('protwise/plotting/plotting.py', 'Plotter.plot_model_fit', 200), coverage: 'full', patterns: [],
    description: 'Best-fit model (solid) and observations (dashed, squares) per state, split at index 8 of the time grid as PhosKinTime does. Null observations are gaps.',
    component: ModelFit,
  },
]
