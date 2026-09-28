import { AgentResponse, ExecutionTraceStep, Evidence } from '../schemas/responses.js';

export interface SessionState {
    sessionId: string;
    createdAt: number;
    messages: Array<{
        role: 'user' | 'model';
        text: string;
        timestamp: number;
    }>;
    evidenceHistory: Evidence[];
    executionHistory: ExecutionTraceStep[];
    currentWorkflow?: string;
    userCorrections: string[];
}

class SessionManager {
    private sessions = new Map<string, SessionState>();

    public getSession(sessionId: string): SessionState {
        let session = this.sessions.get(sessionId);
        if (!session) {
            session = {
                sessionId,
                createdAt: Date.now(),
                messages: [],
                evidenceHistory: [],
                executionHistory: [],
                userCorrections: []
            };
            this.sessions.set(sessionId, session);
        }
        return session;
    }

    public updateSession(sessionId: string, updates: Partial<SessionState>): SessionState {
        const session = this.getSession(sessionId);
        Object.assign(session, updates);
        return session;
    }

    public addMessage(sessionId: string, role: 'user' | 'model', text: string) {
        const session = this.getSession(sessionId);
        session.messages.push({ role, text, timestamp: Date.now() });
    }

    public addEvidence(sessionId: string, evidence: Evidence) {
        const session = this.getSession(sessionId);
        session.evidenceHistory.push(evidence);
    }
    
    public addTrace(sessionId: string, trace: ExecutionTraceStep[]) {
        const session = this.getSession(sessionId);
        session.executionHistory.push(...trace);
    }
}

export const globalSessionManager = new SessionManager();
