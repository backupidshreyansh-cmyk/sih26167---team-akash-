/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Review Export & Reporting Service (Phase 7).
 * Generates JSON, CSV, and formatted analyst reports.
 */

import { ReviewCandidate } from './types.js';

export class ExportService {
  /**
   * Generates a sanitized JSON export of a single candidate or the entire review queue.
   */
  public static exportToJson(candidates: ReviewCandidate | ReviewCandidate[]): string {
    return JSON.stringify(candidates, null, 2);
  }

  /**
   * Generates a compliant CSV export of the review queue.
   */
  public static exportToCsv(candidates: ReviewCandidate[]): string {
    const headers = [
      'candidate_id',
      'status',
      'source_type',
      'change_type',
      'change_percentage',
      'earliest_supported',
      'sensors',
      'acquisition_dates',
      'location_name',
      'crs',
      'similarity_score',
      'quality_status',
      'registration_status',
      'decision',
      'decision_timestamp',
      'rejection_reason',
      'run_id'
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = candidates.map(c => [
      escapeCsv(c.candidateId),
      escapeCsv(c.status),
      escapeCsv(c.sourceType),
      escapeCsv(c.change.changeClassification),
      escapeCsv(c.change.changePercentage.toFixed(1)),
      escapeCsv(c.temporal.earliestSupportedDateOrRange || 'N/A'),
      escapeCsv(c.identity.sensors.join('; ')),
      escapeCsv(c.identity.acquisitionDates.join(' to ')),
      escapeCsv(c.identity.locationName),
      escapeCsv(c.identity.crs || 'UNREFERENCED'),
      escapeCsv(c.retrieval.similarityScore.toFixed(3)),
      escapeCsv(c.quality.overallStatus),
      escapeCsv(c.quality.registrationStatus),
      escapeCsv(c.analystDecision?.decision || 'PENDING'),
      escapeCsv(c.analystDecision?.timestamp || ''),
      escapeCsv(c.analystDecision?.rejectionReason || ''),
      escapeCsv(c.sourceRunId)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generates a structured analyst executive summary report in Markdown.
   */
  public static generateAnalystSummaryReport(candidate: ReviewCandidate): string {
    return `# SATELLITE EVIDENCE & ANALYST AUDIT REPORT
**Candidate ID**: ${candidate.candidateId}
**Source Run ID**: ${candidate.sourceRunId}
**Location**: ${candidate.identity.locationName}
**Spatial CRS**: ${candidate.identity.crs || 'Unreferenced'}
**Acquisition Dates**: ${candidate.identity.acquisitionDates.join(' → ')}
**Sensors**: ${candidate.identity.sensors.join(', ')} (${candidate.identity.modality.toUpperCase()})

---

### 1. DETECTED CHANGE SUMMARY
- **Phenomenon / Classification**: ${candidate.change.changeClassification}
- **Changed Surface Extent**: ${candidate.change.changePercentage.toFixed(2)}% (${candidate.change.changedPixelCount.toLocaleString()} px of ${candidate.change.totalScenePixels.toLocaleString()} total px)
- **Earliest Supported Observation**: ${candidate.temporal.earliestSupportedDateOrRange || 'Single Observation'}
- **Detection Method**: ${candidate.change.changeMethod}

### 2. DATA QUALITY & FALSE-ALARM SCREENING
- **Overall Quality Grade**: ${candidate.quality.overallStatus}
- **Spatial Registration**: ${candidate.quality.registrationStatus}
- **Seasonal Variance**: ${candidate.quality.seasonalDifferenceDetected ? `DETECTED (${candidate.quality.seasonalSeverity} SEVERITY)` : 'NONE'}
- **Cloud & Atmospheric Screening**: ${candidate.quality.cloudStatus}
- **Radiometric Consistency**: ${candidate.quality.radiometricStatus}
- **Spatial Coherence**: ${candidate.quality.spatialCoherenceStatus}
- **Temporal Persistence**: ${candidate.quality.persistenceStatus}

### 3. ANALYST AUDIT DECISION
- **Current Status**: ${candidate.status}
${candidate.analystDecision ? `
- **Decision Recorded**: ${candidate.analystDecision.decision}
- **Decision Timestamp**: ${candidate.analystDecision.timestamp}
${candidate.analystDecision.rejectionReason ? `- **Rejection Reason**: ${candidate.analystDecision.rejectionReason}` : ''}
${candidate.analystDecision.confirmedEvidence?.length ? `- **Confirmed Evidence**: ${candidate.analystDecision.confirmedEvidence.join(', ')}` : ''}
${candidate.analystDecision.analystNotes ? `- **Analyst Notes**: ${candidate.analystDecision.analystNotes}` : ''}
` : '- **Decision Status**: PENDING ANALYST VERIFICATION'}

### 4. PROCESSING PROVENANCE
- **Processing Version**: ${candidate.provenance.processingVersion}
- **Local Embedding Model**: ${candidate.provenance.modelVersion} (${candidate.provenance.embeddingVersion})
- **Enqueued**: ${candidate.provenance.timestamps.enqueued}
- **Last Modified**: ${candidate.provenance.timestamps.lastModified}

*Generated locally by SatQuery AI under ISRO / SIH-26227 specification protocols.*
`;
  }
}
