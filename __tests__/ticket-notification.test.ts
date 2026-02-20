import { describe, it, expect } from 'vitest';
import { buildTicketReplyNotification } from '../lib/notification-utils';

describe('buildTicketReplyNotification', () => {
  const userId = 'user-abc-123';
  const ticketId = 'ticket-xyz-456';
  const oggetto = 'Problema con il rimborso di marzo';

  it('returns correct entity_type and entity_id', () => {
    const n = buildTicketReplyNotification(userId, ticketId, oggetto);
    expect(n.entity_type).toBe('ticket');
    expect(n.entity_id).toBe(ticketId);
  });

  it('targets the correct user_id', () => {
    const n = buildTicketReplyNotification(userId, ticketId, oggetto);
    expect(n.user_id).toBe(userId);
  });

  it('sets tipo to risposta_ticket', () => {
    const n = buildTicketReplyNotification(userId, ticketId, oggetto);
    expect(n.tipo).toBe('risposta_ticket');
  });

  it('includes ticket oggetto in the message', () => {
    const n = buildTicketReplyNotification(userId, ticketId, oggetto);
    expect(n.messaggio).toContain(oggetto);
  });

  it('has a non-empty titolo', () => {
    const n = buildTicketReplyNotification(userId, ticketId, oggetto);
    expect(n.titolo.length).toBeGreaterThan(0);
  });

  it('works with different ticket subjects', () => {
    const n1 = buildTicketReplyNotification(userId, ticketId, 'Accesso bloccato');
    const n2 = buildTicketReplyNotification(userId, ticketId, 'Documento mancante');
    expect(n1.messaggio).toContain('Accesso bloccato');
    expect(n2.messaggio).toContain('Documento mancante');
  });
});
