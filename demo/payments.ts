import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { withIdempotency } from '../lib/idempotency';

export const PaymentRequest = z.object({
  /** Unidades menores (centavos). 1999.99 ARS => 199999. Nunca floats para dinero. */
  amount: z.number().int().positive(),
  currency: z.enum(['ARS', 'USD']),
  customerId: z.string().uuid(),
  paymentMethodId: z.string().min(1),
});
export type PaymentRequest = z.infer<typeof PaymentRequest>;

export async function paymentsRoutes(app: FastifyInstance) {
  app.post('/payments', async (req, reply) => {
    const parsed = PaymentRequest.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ errors: parsed.error.flatten() });
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string') return reply.code(400).send({ error: 'Idempotency-Key header required' });
    return withIdempotency(key, () => chargeCustomer(parsed.data));
  });
}
