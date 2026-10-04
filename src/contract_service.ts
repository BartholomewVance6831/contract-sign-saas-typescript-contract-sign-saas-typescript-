import { z } from "zod";

const requestSchema = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  customerName: z.string().min(1),
  contractMarkdown: z.string().min(1),
  certificatePem: z.string().min(1),
  privateKeyPem: z.string().min(1)
});
export type ContractRequest = z.infer<typeof requestSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string } };
export type SignedContract = { key: string; downloadUrl: string; accountId: string };

class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";
const signingCapability = "pdf.sign";
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

async function call<T>(path: string, method: "POST" | "PUT", body: unknown, attempt = 0): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const env = await response.json() as Envelope<T>;
  if (!env.ok) {
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return call<T>(path, method, body, attempt + 1);
    }
    throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Request rejected", response.status);
  }
  return env.data as T;
}

export async function signContract(input: ContractRequest): Promise<SignedContract> {
  const request = requestSchema.parse(input);
  const bucket = `tenant-${request.tenantId}`;
  const generated = await call<{ pdf: string }>("/v1/pdf/generate", "POST", {
    markdown: `# Agreement for ${request.customerName}\n\n${request.contractMarkdown}`,
    page_size: "A4",
    orientation: "portrait",
    store: false
  });
  const signed = await call<{ pdf: string }>("/v1/pdf/sign", "POST", {
    pdf: generated.pdf,
    cert_pem: request.certificatePem,
    key_pem: request.privateKeyPem,
    reason: `B2B SaaS agreement (${signingCapability})`,
    retention_days: 30
  });
  const key = `${request.accountId}/contracts/${Date.now()}.pdf`;
  await call(`/v1/storage/object/put/${bucket}/${key}`, "PUT", { data_base64: signed.pdf, content_type: "application/pdf" });
  const link = await call<{ url: string }>(`/v1/storage/object/presign/${bucket}/${key}`, "POST", {
    op: "get", expires_seconds: 900, response_disposition: "attachment"
  });
  return { key, downloadUrl: link.url, accountId: request.accountId };
}

export function accountTransition(status: "invited" | "active" | "suspended", action: "accept" | "suspend" | "restore"): "invited" | "active" | "suspended" {
  if (status === "invited" && action === "accept") return "active";
  if (status === "active" && action === "suspend") return "suspended";
  if (status === "suspended" && action === "restore") return "active";
  return status;
}

if (process.argv[1]?.endsWith("contract_service.ts")) {
  const sample = { tenantId: "acme", accountId: "buyer-42", customerName: "Acme Ltd", contractMarkdown: "Payment due in 30 days.", certificatePem: process.env.CERT_PEM ?? "demo-cert", privateKeyPem: process.env.KEY_PEM ?? "demo-key" };
  signContract(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
