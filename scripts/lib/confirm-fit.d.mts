import type { Download, Page } from '@playwright/test'
export function confirmFit(page: Page, download: Promise<Download>): Promise<string[]>
