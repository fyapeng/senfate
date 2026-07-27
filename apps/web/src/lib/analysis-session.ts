export interface AnalysisSession { compiled: unknown; analysis: unknown; createdAt: number }
const sessions = new Map<string, AnalysisSession>();
export function saveSession(compiled: unknown, analysis: unknown): string { const id = crypto.randomUUID(); sessions.set(id,{compiled,analysis,createdAt:Date.now()}); return id }
export function readSession(id: string): AnalysisSession | undefined { return sessions.get(id) }
