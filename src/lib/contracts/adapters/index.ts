import type { VersionAdapter } from './types'
import { adapterV1 } from './v1'

/** One adapter per supported bundle_schema major. Add new majors here. */
export const ADAPTERS: VersionAdapter[] = [adapterV1]

export function adapterFor(major: number): VersionAdapter | undefined {
  return ADAPTERS.find((a) => a.major === major)
}

export function supportedMajors(): number[] {
  return ADAPTERS.map((a) => a.major)
}
