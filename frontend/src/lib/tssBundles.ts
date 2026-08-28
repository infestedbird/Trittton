import type { Section } from '../types'
import { sectionAvailStatus } from './availability'

export interface SectionBundle {
  packageId: string
  sections: Section[]
  openSeats: number
  hasWaitlist: boolean
}

export function buildSectionBundles(sections: Section[]): SectionBundle[] {
  const byPackage = new Map<string, Section[]>()
  for (const section of sections) {
    for (const packageId of section.event_package_ids || []) {
      const current = byPackage.get(packageId) || []
      if (!current.some((item) => item.section_id === section.section_id)) current.push(section)
      byPackage.set(packageId, current)
    }
  }

  const signatures = new Set<string>()
  const bundles: SectionBundle[] = []
  for (const [packageId, packageSections] of byPackage) {
    if (new Set(packageSections.map((section) => section.type)).size < 2) continue
    const signature = packageSections.map((section) => section.section_id).sort().join('|')
    if (signatures.has(signature)) continue
    signatures.add(signature)
    bundles.push({
      packageId,
      sections: packageSections,
      openSeats: Math.min(...packageSections.map((section) => sectionAvailStatus(section).seats)),
      hasWaitlist: packageSections.some((section) => sectionAvailStatus(section).status === 'waitlist'),
    })
  }

  return bundles.sort((a, b) => {
    if ((a.openSeats > 0) !== (b.openSeats > 0)) return a.openSeats > 0 ? -1 : 1
    if (a.hasWaitlist !== b.hasWaitlist) return a.hasWaitlist ? -1 : 1
    return b.openSeats - a.openSeats
  })
}
