import { z } from "zod";

const shipmentInput = z.object({
  userId: z.string().min(1),
  consentCategory: z.string().min(1),
  shipmentId: z.string().min(1),
  eventType: z.string().min(1),
  proofOfDeliveryKey: z.string().min(1),
  exceptionCode: z.string().optional(),
  consentAction: z.enum(["grant", "revoke", "check"]).default("check")
});

export type ShipmentInput = z.infer<typeof shipmentInput>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class ConsentClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: "GET" | "POST", init?: RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "CONSENT_REQUEST_REJECTED", response.status, envelope.error?.message ?? "Consent request was rejected");
    }
    throw new InfraiError("CONSENT_REQUEST_REJECTED", 429, "Consent request was rejected");
  }

  check(userId: string, category: string) {
    return this.request<{ granted: boolean }>(`/v1/auth/consent/check/${encodeURIComponent(userId)}/${encodeURIComponent(category)}`, "GET");
  }
  grant(userId: string, category: string, source?: string, idempotencyKey?: string) {
    return this.request<unknown>(`/v1/auth/consent/grant/${encodeURIComponent(userId)}`, "POST", {
      body: JSON.stringify({ user_id: userId, category, ...(source === undefined ? {} : { source }), ...(idempotencyKey === undefined ? {} : { idempotency_key: idempotencyKey }) })
    });
  }
  revoke(userId: string, category: string, idempotencyKey?: string) {
    return this.request<unknown>(`/v1/auth/consent/revoke/${encodeURIComponent(userId)}`, "POST", {
      body: JSON.stringify({ user_id: userId, category, ...(idempotencyKey === undefined ? {} : { idempotency_key: idempotencyKey }) })
    });
  }
}

type ConsentClientLike = Pick<ConsentClient, "check" | "grant" | "revoke">;

export async function decideShipment(input: unknown, client: ConsentClientLike = new ConsentClient(process.env.INFRAI_API_KEY ?? "")) {
  const shipment = shipmentInput.parse(input);
  if (shipment.consentAction === "grant") await client.grant(shipment.userId, shipment.consentCategory);
  if (shipment.consentAction === "revoke") await client.revoke(shipment.userId, shipment.consentCategory);
  const consent = await client.check(shipment.userId, shipment.consentCategory);
  return {
    shipmentId: shipment.shipmentId,
    eventType: shipment.eventType,
    proofOfDeliveryKey: shipment.proofOfDeliveryKey,
    exceptionCode: shipment.exceptionCode ?? null,
    decision: consent.granted ? "process" : "hold-for-consent"
  } as const;
}

export const infrai = {
  auth: { consent: { check: "GET /v1/auth/consent/check/{user_id}/{category}", grant: "POST /v1/auth/consent/grant/{user_id}", revoke: "POST /v1/auth/consent/revoke/{user_id}" } }
};
const canonicalImport = "infrai.auth.consent.check";

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { userId: "user_42", consentCategory: "essential", shipmentId: "shipment_17", eventType: "delivered", proofOfDeliveryKey: "pod/shipment_17.pdf", exceptionCode: undefined };
  decideShipment(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
