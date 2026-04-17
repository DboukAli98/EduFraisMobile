import type { Href } from 'expo-router';
import type { AppNotification, UserRole } from '../types';

/**
 * Lower-case + strip diacritics so we can match French and English type
 * strings with a single keyword check. e.g. "Approbation d'étudiant"
 * → "approbation d'etudiant".
 */
const normalize = (s: string | undefined | null): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Resolve the route a notification should navigate to when tapped.
 *
 * Resolution order:
 *  1) Deep link via `relatedEntityType` + `relatedEntityId` (if backend
 *     populates them) — this lands on the *specific* entity detail screen.
 *  2) Keyword match on the (locale-tolerant) `type` string + recipient role
 *     — falls back to the most relevant section for that user.
 *  3) Returns null when there's no good destination → caller leaves the
 *     row inert instead of navigating somewhere arbitrary.
 *
 * Keep this pure (no hooks, no router calls) so it stays easy to unit-test
 * and so the screen stays the only thing that knows about navigation.
 */
export function resolveNotificationRoute(
  notification: AppNotification,
  role: UserRole | undefined,
): Href | null {
  // ─── 1) Deep link via structured metadata ──────────────────────
  const entityType = normalize(notification.relatedEntityType);
  const entityId = notification.relatedEntityId;

  if (entityType && entityId && entityId > 0) {
    switch (entityType) {
      case 'child':
      case 'children':
        // Director gets the director-side detail; parent gets the
        // parent-side child detail.
        if (role === 'director') {
          return {
            pathname: '/(app)/director-child-detail',
            params: { childId: String(entityId) },
          };
        }
        return {
          pathname: '/(app)/child-detail',
          params: { childId: String(entityId) },
        };

      case 'parent':
        return {
          pathname: '/(app)/director-parent-detail',
          params: { parentId: String(entityId) },
        };

      case 'agent':
      case 'collectingagent':
        if (role === 'parent') {
          return {
            pathname: '/(app)/parent-agent-detail',
            params: { agentId: String(entityId) },
          };
        }
        return {
          pathname: '/(app)/agent-detail',
          params: { agentId: String(entityId) },
        };

      case 'agentrequest':
      case 'parentagentrequest':
        // Director reviews requests; parent watches their request status.
        return role === 'director'
          ? '/(app)/agent-requests'
          : '/(app)/my-agents';

      case 'supportrequest':
      case 'support':
        return {
          pathname: '/(app)/support-request',
          params: { supportRequestId: String(entityId) },
        };

      case 'payment':
      case 'paymenttransaction':
        return {
          pathname: '/(app)/payment-detail',
          params: { paymentId: String(entityId) },
        };

      case 'installment':
        return {
          pathname: '/(app)/payment-detail',
          params: { installmentId: String(entityId) },
        };

      // Unknown entity type → fall through to keyword routing below.
    }
  }

  // ─── 2) Keyword match on type + recipient role ─────────────────
  const type = normalize(notification.type);

  // Child approval / rejection. Backend currently sends
  // "Approbation d'étudiant", "Rejet d'étudiant", or "Demande d'ajout
  // d'enfants". Director needs to act on incoming requests; parent
  // wants to see the result.
  const isChildApprovalish =
    type.includes('approbation') ||
    type.includes('approval') ||
    type.includes('rejet') ||
    type.includes('rejection') ||
    type.includes("demande d'ajout") ||
    type.includes('ajout d enfant') ||
    type.includes('child added') ||
    type.includes('new child') ||
    type.includes('etudiant') ||
    type.includes('enfant');

  if (isChildApprovalish) {
    // Director side: pending children list lives in the Students tab.
    if (role === 'director') return '/(app)/students';
    // Parent side: their children list (where status badges show).
    return '/(app)/children';
  }

  // Support / assistance requests
  if (type.includes('assistance') || type.includes('support')) {
    return '/(app)/support';
  }

  // Agent request lifecycle
  if (
    type.includes('agentrequestpending') ||
    type === 'agentrequest' ||
    type.includes('demande agent') ||
    type.includes('agent request')
  ) {
    return role === 'director' ? '/(app)/agent-requests' : '/(app)/my-agents';
  }
  if (
    type.includes('agentrequestapproved') ||
    type.includes('agentrequestrejected')
  ) {
    return '/(app)/my-agents';
  }

  // Parent assignment notification → agent's portfolio
  if (type.includes('parentassignment') || type.includes('attribution parent')) {
    return '/(app)/portfolio';
  }

  // Payments / reminders
  if (
    type.includes('payment') ||
    type.includes('paiement') ||
    type.includes('reminder') ||
    type.includes('rappel')
  ) {
    return '/(app)/payments';
  }

  // No good match — caller will simply not navigate.
  return null;
}
