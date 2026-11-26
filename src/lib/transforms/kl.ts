/**
 * protwise plot_kld (plotting.py:379-396 at e634e17): each (gene, psite) row of observed and
 * estimated values over time is divided by its row sum; KL(obs || est) with scipy.stats.entropy
 * (natural log); mean per gene; bars flagged when KL > 0.03.
 *
 * Gaps: PhosKinTime's rows have no nulls. Where a bundle row has nulls, this uses the time points
 * where both values exist (pairwise complete) and reports how many points were dropped.
 */
export const KL_THRESHOLD = 0.03

/** scipy.stats.entropy(pk, qk): normalises both, sum pk*log(pk/qk), 0*log(0/q)=0, p>0 & q=0 -> inf. */
export function entropyKL(pk: number[], qk: number[]): number {
  const sp = pk.reduce((a, b) => a + b, 0)
  const sq = qk.reduce((a, b) => a + b, 0)
  let s = 0
  for (let i = 0; i < pk.length; i++) {
    const p = pk[i] / sp
    const q = qk[i] / sq
    if (p > 0 && q > 0) s += p * Math.log(p / q)
    else if (p > 0 && q <= 0) return Infinity
    else if (p < 0 || q < 0) return Infinity
  }
  return s
}

export interface KlRow {
  gene: string
  site: string
  kl: number
  points: number
  dropped: number
}

export function klRow(gene: string, site: string, obs: number[], est: number[]): KlRow {
  const o: number[] = []
  const e: number[] = []
  for (let i = 0; i < obs.length; i++) {
    if (Number.isFinite(obs[i]) && Number.isFinite(est[i])) {
      o.push(obs[i])
      e.push(est[i])
    }
  }
  // explicit row normalisation as in plot_kld (scipy renormalises again; harmless)
  const so = o.reduce((a, b) => a + b, 0)
  const se = e.reduce((a, b) => a + b, 0)
  const kl = o.length ? entropyKL(o.map((v) => v / so), e.map((v) => v / se)) : NaN
  return { gene, site, kl, points: o.length, dropped: obs.length - o.length }
}

export function klByGene(rows: KlRow[]): { gene: string; kl: number; sites: number; flagged: boolean }[] {
  const by = new Map<string, number[]>()
  for (const r of rows) if (Number.isFinite(r.kl) || r.kl === Infinity) (by.get(r.gene) ?? by.set(r.gene, []).get(r.gene)!).push(r.kl)
  return [...by.entries()]
    .map(([gene, v]) => {
      const kl = v.reduce((a, b) => a + b, 0) / v.length
      return { gene, kl, sites: v.length, flagged: kl > KL_THRESHOLD }
    })
    .sort((a, b) => a.kl - b.kl)
}
