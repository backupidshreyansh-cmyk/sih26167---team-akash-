/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Machine-Readable Evidence Graph & Provenance Tracker:
 * Encodes the traceable flow:
 * CLAIM -> REQUIRED EVIDENCE -> MEASURED EVIDENCE -> SPATIAL REGION -> TOOL/MODEL -> VERIFICATION -> DECISION
 */

import crypto from 'crypto';
import { 
  EvidenceGraph, 
  EvidenceGraphNode, 
  EvidenceGraphEdge, 
  EvidenceProvenance 
} from './types.js';

export class EvidenceGraphBuilder {
  private nodes: EvidenceGraphNode[] = [];
  private edges: EvidenceGraphEdge[] = [];

  /**
   * Computes SHA-256 hash of raw raster data for immutable provenance.
   */
  public static computeSha256(data: string | Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Builds an authoritative provenance record.
   */
  public static createProvenance(
    sourceFile: string,
    fileSizeBytes: number,
    dataToHash: string | Buffer,
    tool: string,
    operation: string,
    parameters: Record<string, any> = {}
  ): EvidenceProvenance {
    return {
      sourceFile,
      fileSizeBytes,
      fileSha256: this.computeSha256(dataToHash),
      tool,
      toolVersion: '2.0.0-evidence-engine',
      operation,
      parameters,
      timestamp: new Date().toISOString()
    };
  }

  public addClaim(id: string, text: string, status: EvidenceGraphNode['status'] = 'PENDING'): this {
    this.nodes.push({ id, type: 'CLAIM', label: text, status });
    return this;
  }

  public addRequiredEvidence(id: string, requirement: string, claimId: string): this {
    this.nodes.push({ id, type: 'REQUIRED_EVIDENCE', label: requirement, status: 'PENDING' });
    this.edges.push({ from: claimId, to: id, relationship: 'REQUIRES' });
    return this;
  }

  public addMeasuredEvidence(
    id: string, 
    measurementText: string, 
    reqId: string, 
    provenance?: EvidenceProvenance,
    status: EvidenceGraphNode['status'] = 'VERIFIED'
  ): this {
    this.nodes.push({ id, type: 'MEASURED_EVIDENCE', label: measurementText, status, provenance });
    this.edges.push({ from: id, to: reqId, relationship: 'PROVES' });
    return this;
  }

  public addSpatialRegion(id: string, regionDescription: string, evidenceId: string): this {
    this.nodes.push({ id, type: 'SPATIAL_REGION', label: regionDescription, status: 'VERIFIED' });
    this.edges.push({ from: evidenceId, to: id, relationship: 'LOCATED_AT' });
    return this;
  }

  public addVerificationGate(
    id: string, 
    gateEvaluation: string, 
    evidenceId: string, 
    status: EvidenceGraphNode['status'] = 'VERIFIED'
  ): this {
    this.nodes.push({ id, type: 'VERIFICATION_GATE', label: gateEvaluation, status });
    this.edges.push({ from: evidenceId, to: id, relationship: 'VERIFIED_BY' });
    return this;
  }

  public addDecision(id: string, decisionText: string, gateId: string, isVerified: boolean): this {
    this.nodes.push({
      id,
      type: 'DECISION',
      label: decisionText,
      status: isVerified ? 'VERIFIED' : 'UNAVAILABLE'
    });
    this.edges.push({ from: gateId, to: id, relationship: 'YIELDS' });
    return this;
  }

  public build(): EvidenceGraph {
    let totalClaims = 0;
    let verifiedClaims = 0;
    let conflictedClaims = 0;
    let insufficientClaims = 0;

    for (const node of this.nodes) {
      if (node.type === 'CLAIM') {
        totalClaims++;
        if (node.status === 'VERIFIED') verifiedClaims++;
        else if (node.status === 'CONFLICT') conflictedClaims++;
        else insufficientClaims++;
      }
    }

    return {
      nodes: this.nodes,
      edges: this.edges,
      summary: {
        totalClaims,
        verifiedClaims,
        conflictedClaims,
        insufficientClaims
      }
    };
  }
}
