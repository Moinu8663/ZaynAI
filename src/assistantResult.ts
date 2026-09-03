export type FindingCategory = "error" | "performance" | "security" | "code-review";
export type Severity = "critical" | "high" | "medium" | "low";

export type Finding = {
  category: FindingCategory;
  severity: Severity;
  file?: string;
  line?: number;
  title: string;
  description: string;
  recommendation: string;
};

export type GeneratedChange = {
  path: string;
  content: string;
  description?: string;
};

export type AssistantResult = {
  summary: string;
  findings: Finding[];
  changes: GeneratedChange[];
  raw: string;
};

const categories = new Set<FindingCategory>(["error", "performance", "security", "code-review"]);
const severities  = new Set<Severity>(["critical", "high", "medium", "low"]);

export function parseAssistantResult(raw: string): AssistantResult {
  // Try fenced JSON block first, then bare JSON object
  const fenced   = raw.match(/```json\s*([\s\S]*?)\s*```/i)?.[1];
  const bareJson = raw.match(/(\{[\s\S]*\})/)?.[1];
  const candidate = fenced ?? bareJson ?? raw.trim();

  try {
    const value = JSON.parse(candidate);
    if (!value || typeof value !== "object") throw new Error();

    const findings = Array.isArray(value.findings)
      ? value.findings.filter(isFinding).map(normalizeFinding)
      : [];

    const changes = Array.isArray(value.changes)
      ? value.changes.filter(isChange).map((c: GeneratedChange) => ({
          path: c.path.replace(/\\/g, "/"),
          content: c.content,
          description: c.description
        }))
      : [];

    return {
      summary: typeof value.summary === "string" && value.summary.trim()
        ? value.summary
        : raw,
      findings,
      changes,
      raw
    };
  } catch {
    return { summary: raw, findings: [], changes: [], raw };
  }
}

function isFinding(v: any): v is Finding {
  return v && typeof v.title === "string" && typeof v.description === "string";
}

function normalizeFinding(f: Finding): Finding {
  return {
    ...f,
    category:       categories.has(f.category) ? f.category : "code-review",
    severity:       severities.has(f.severity)  ? f.severity  : "medium",
    recommendation: typeof f.recommendation === "string" ? f.recommendation : "Review and address this issue."
  };
}

function isChange(v: any): v is GeneratedChange {
  return v && typeof v.path === "string" && typeof v.content === "string";
}
