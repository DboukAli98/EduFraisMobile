import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { useTheme } from "../../theme";
import ThemedText from "../common/ThemedText";
import ThemedCard from "../common/ThemedCard";
import { formatCurrency } from "../../utils";
import type {
  MwanaBotAction,
  MwanaBotActionSeverity,
  MwanaBotChildSummary,
  MwanaBotInstallmentSummary,
  MwanaBotLoyaltyMembership,
  MwanaBotRecentPaymentSummary,
  MwanaBotToolResult,
  MwanaBotToolData,
} from "../../types";

/**
 * Renders one structured tool result emitted by MwanaBot as a rich,
 * branded card — instead of dumping the bot's raw markdown / `**`-laden
 * text into the chat bubble.
 *
 * The component switches on `data.kind` (children / schools /
 * installments / balance / recent_payments / loyalty) and falls back to
 * a degraded "summary text" card when the kind is unknown — so a future
 * backend tool kind doesn't crash older clients.
 *
 * Each card optionally renders 0..N action buttons under it. Tapping a
 * button calls `router.push(action.route)` so the user lands on the
 * relevant screen (Pay now, see history, see loyalty, etc.).
 */

const formatDate = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const ActionButtons: React.FC<{ actions: MwanaBotAction[] }> = ({ actions }) => {
  const { theme } = useTheme();
  const router = useRouter();

  if (!actions || actions.length === 0) return null;

  const onPress = (action: MwanaBotAction) => {
    if (!action.route) return;
    router.push({ pathname: action.route as any, params: action.params ?? {} });
  };

  return (
    <View style={styles.actionsRow}>
      {actions.map((action, index) => {
        const severity: MwanaBotActionSeverity = action.severity ?? "default";
        const bg =
          severity === "primary"
            ? theme.colors.primary
            : severity === "warning"
              ? theme.colors.error
              : theme.colors.surface;
        const fg =
          severity === "default" ? theme.colors.primary : "#FFFFFF";
        const borderColor =
          severity === "default"
            ? theme.colors.primary
            : "transparent";

        return (
          <Pressable
            key={`${action.label}-${index}`}
            onPress={() => onPress(action)}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: bg,
                borderRadius: theme.borderRadius.md,
                borderWidth: severity === "default" ? 1 : 0,
                borderColor,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <ThemedText
              variant="caption"
              color={fg}
              style={styles.actionLabel}
            >
              {action.label}
            </ThemedText>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={fg}
              style={styles.actionIcon}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

// ─── Per-kind renderers ────────────────────────────────────────────

const ChildrenCard: React.FC<{ items: MwanaBotChildSummary[] }> = ({ items }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (!items.length) {
    return (
      <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
        {t("mwanabot.tool.children.empty", "Aucun enfant enregistré.")}
      </ThemedText>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((child, idx) => {
        const tone =
          child.status === "approved"
            ? theme.colors.success
            : child.status === "rejected"
              ? theme.colors.error
              : theme.colors.warning;

        return (
          <View key={`${child.fullName}-${idx}`} style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: tone + "22" }]}>
              <Ionicons name="person" size={18} color={tone} />
            </View>
            <View style={styles.rowBody}>
              <ThemedText variant="body" style={styles.rowTitle}>
                {child.fullName}
              </ThemedText>
              <ThemedText
                variant="caption"
                color={theme.colors.textSecondary}
                numberOfLines={1}
              >
                {[child.schoolName, child.gradeName].filter(Boolean).join(" • ")}
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: tone + "20", borderColor: tone },
              ]}
            >
              <ThemedText variant="caption" color={tone} style={styles.statusText}>
                {child.statusLabel}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const SchoolsCard: React.FC<{ items: { schoolName: string }[] }> = ({ items }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.list}>
      {items.map((school, idx) => (
        <View key={`${school.schoolName}-${idx}`} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary + "18" }]}>
            <Ionicons name="school" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.rowBody}>
            <ThemedText variant="body" style={styles.rowTitle}>
              {school.schoolName}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
};

const InstallmentsCard: React.FC<{
  items: MwanaBotInstallmentSummary[];
  focus?: "all" | "upcoming" | "overdue";
}> = ({ items, focus = "all" }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (!items.length) {
    const empty =
      focus === "upcoming"
        ? t("mwanabot.tool.installments.emptyUpcoming", "Tout est à jour.")
        : focus === "overdue"
          ? t("mwanabot.tool.installments.emptyOverdue", "Aucun retard. Tout est en ordre.")
          : t("mwanabot.tool.installments.emptyAll", "Aucun versement.");
    return (
      <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
        {empty}
      </ThemedText>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((inst, idx) => {
        const tone = inst.isPaid
          ? theme.colors.success
          : inst.isOverdue
            ? theme.colors.error
            : theme.colors.primary;
        const statusLabel = inst.isPaid
          ? t("mwanabot.tool.installments.paid", "Payé")
          : inst.isOverdue
            ? t("mwanabot.tool.installments.overdueDays", "{{count}} j de retard", {
                count: inst.daysLate,
              })
            : t("mwanabot.tool.installments.toPay", "À payer");

        return (
          <View key={`${inst.dueDate}-${idx}`} style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: tone + "20" }]}>
              <Ionicons
                name={
                  inst.isPaid
                    ? "checkmark-circle"
                    : inst.isOverdue
                      ? "alert-circle"
                      : "calendar-outline"
                }
                size={18}
                color={tone}
              />
            </View>
            <View style={styles.rowBody}>
              <ThemedText variant="body" style={styles.rowTitle}>
                {formatCurrency(inst.amount + inst.lateFee)}
              </ThemedText>
              <ThemedText
                variant="caption"
                color={theme.colors.textSecondary}
                numberOfLines={1}
              >
                {inst.childName} • {formatDate(inst.dueDate)}
                {inst.lateFee > 0
                  ? ` • +${formatCurrency(inst.lateFee)} pénalité`
                  : ""}
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: tone + "20", borderColor: tone },
              ]}
            >
              <ThemedText variant="caption" color={tone} style={styles.statusText}>
                {statusLabel}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const BalanceCard: React.FC<{
  total: number;
  paid: number;
  pending: number;
  overdueCount: number;
}> = ({ total, paid, pending, overdueCount }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const paidRatio = total > 0 ? Math.min(1, paid / total) : 0;

  return (
    <View>
      <View style={styles.balanceTopRow}>
        <View style={styles.balanceMain}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t("mwanabot.tool.balance.pending", "Reste à payer")}
          </ThemedText>
          <ThemedText
            variant="h2"
            color={
              pending > 0 ? theme.colors.primary : theme.colors.success
            }
            style={styles.balanceMainValue}
          >
            {formatCurrency(pending)}
          </ThemedText>
        </View>
        {overdueCount > 0 ? (
          <View
            style={[
              styles.balanceBadge,
              {
                backgroundColor: theme.colors.error + "18",
                borderColor: theme.colors.error,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
            <ThemedText
              variant="caption"
              color={theme.colors.error}
              style={styles.balanceBadgeText}
            >
              {t("mwanabot.tool.balance.overdueCount", "{{count}} en retard", {
                count: overdueCount,
              })}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View
        style={[styles.progressBg, { backgroundColor: theme.colors.borderLight }]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(paidRatio * 100)}%`,
              backgroundColor: theme.colors.success,
            },
          ]}
        />
      </View>

      <View style={styles.balanceFooterRow}>
        <View style={styles.balanceFooterStat}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t("mwanabot.tool.balance.total", "Total")}
          </ThemedText>
          <ThemedText variant="bodySmall" style={styles.balanceFooterValue}>
            {formatCurrency(total)}
          </ThemedText>
        </View>
        <View style={styles.balanceFooterStat}>
          <ThemedText variant="caption" color={theme.colors.textSecondary}>
            {t("mwanabot.tool.balance.paid", "Payé")}
          </ThemedText>
          <ThemedText
            variant="bodySmall"
            color={theme.colors.success}
            style={styles.balanceFooterValue}
          >
            {formatCurrency(paid)}
          </ThemedText>
        </View>
      </View>
    </View>
  );
};

const RecentPaymentsCard: React.FC<{ items: MwanaBotRecentPaymentSummary[] }> = ({
  items,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.list}>
      {items.map((tx, idx) => (
        <View key={`${tx.transactionReference}-${idx}`} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.success + "22" }]}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={theme.colors.success}
            />
          </View>
          <View style={styles.rowBody}>
            <ThemedText variant="body" style={styles.rowTitle}>
              {formatCurrency(tx.amount)}
            </ThemedText>
            <ThemedText
              variant="caption"
              color={theme.colors.textSecondary}
              numberOfLines={1}
            >
              {tx.childName} • {formatDate(tx.paidDate)} • {tx.paymentMethod}
            </ThemedText>
          </View>
          <View style={styles.refPill}>
            <ThemedText variant="caption" color={theme.colors.textTertiary}>
              {tx.transactionReference}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
};

const LoyaltyCard: React.FC<{ memberships: MwanaBotLoyaltyMembership[] }> = ({
  memberships,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.list}>
      {memberships.map((m, idx) => {
        const ratio =
          m.minimumRedeemPoints > 0
            ? Math.min(1, m.balance / m.minimumRedeemPoints)
            : 1;
        const isReady = ratio >= 1;
        return (
          <View key={`${m.schoolName}-${idx}`} style={styles.loyaltyItem}>
            <View style={styles.loyaltyHeader}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.colors.primary + "20" },
                ]}
              >
                <Ionicons name="star" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText variant="body" style={styles.rowTitle}>
                  {m.balance} {m.pointsLabel}
                </ThemedText>
                <ThemedText
                  variant="caption"
                  color={theme.colors.textSecondary}
                  numberOfLines={1}
                >
                  {m.schoolName} • {m.programName}
                </ThemedText>
              </View>
            </View>
            {m.minimumRedeemPoints > 0 ? (
              <>
                <View
                  style={[
                    styles.progressBg,
                    {
                      backgroundColor: theme.colors.borderLight,
                      marginTop: 8,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.round(ratio * 100)}%`,
                        backgroundColor: isReady
                          ? theme.colors.success
                          : theme.colors.primary,
                      },
                    ]}
                  />
                </View>
                <ThemedText
                  variant="caption"
                  color={
                    isReady ? theme.colors.success : theme.colors.textSecondary
                  }
                  style={{ marginTop: 4 }}
                >
                  {isReady
                    ? t(
                        "mwanabot.tool.loyalty.ready",
                        "Seuil de rachat atteint",
                      )
                    : t(
                        "mwanabot.tool.loyalty.remaining",
                        "encore {{count}} {{label}} avant rachat",
                        {
                          count: m.remainingToRedeem,
                          label: m.pointsLabel,
                        },
                      )}
                </ThemedText>
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

// ─── Main switcher ────────────────────────────────────────────

interface CardHeaderConfig {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titleKey: string;
  fallbackTitle: string;
  iconColorToken: "primary" | "success" | "warning" | "error";
}

const CARD_HEADER: Record<string, CardHeaderConfig> = {
  children: {
    icon: "people-outline",
    titleKey: "mwanabot.tool.children.title",
    fallbackTitle: "Mes enfants",
    iconColorToken: "primary",
  },
  schools: {
    icon: "school-outline",
    titleKey: "mwanabot.tool.schools.title",
    fallbackTitle: "Mes écoles",
    iconColorToken: "primary",
  },
  installments_all: {
    icon: "list-outline",
    titleKey: "mwanabot.tool.installments.allTitle",
    fallbackTitle: "Vos versements",
    iconColorToken: "primary",
  },
  installments_upcoming: {
    icon: "calendar-outline",
    titleKey: "mwanabot.tool.installments.upcomingTitle",
    fallbackTitle: "Prochains versements",
    iconColorToken: "primary",
  },
  installments_overdue: {
    icon: "alert-circle-outline",
    titleKey: "mwanabot.tool.installments.overdueTitle",
    fallbackTitle: "Versements en retard",
    iconColorToken: "error",
  },
  balance: {
    icon: "wallet-outline",
    titleKey: "mwanabot.tool.balance.title",
    fallbackTitle: "Votre solde scolaire",
    iconColorToken: "primary",
  },
  recent_payments: {
    icon: "receipt-outline",
    titleKey: "mwanabot.tool.recentPayments.title",
    fallbackTitle: "Paiements récents",
    iconColorToken: "success",
  },
  loyalty: {
    icon: "star-outline",
    titleKey: "mwanabot.tool.loyalty.title",
    fallbackTitle: "Programme de fidélité",
    iconColorToken: "primary",
  },
};

const resolveHeaderKey = (data: MwanaBotToolData): string => {
  if (data.kind === "installments") {
    const focus = (data as { focus?: string }).focus ?? "all";
    return `installments_${focus}`;
  }
  return data.kind;
};

const renderBody = (data: MwanaBotToolData): React.ReactNode => {
  switch (data.kind) {
    case "children":
      return <ChildrenCard items={(data as any).items ?? []} />;
    case "schools":
      return <SchoolsCard items={(data as any).items ?? []} />;
    case "installments":
      return (
        <InstallmentsCard
          items={(data as any).items ?? []}
          focus={(data as any).focus ?? "all"}
        />
      );
    case "balance":
      return (
        <BalanceCard
          total={Number((data as any).total) || 0}
          paid={Number((data as any).paid) || 0}
          pending={Number((data as any).pending) || 0}
          overdueCount={Number((data as any).overdueCount) || 0}
        />
      );
    case "recent_payments":
      return <RecentPaymentsCard items={(data as any).items ?? []} />;
    case "loyalty":
      return <LoyaltyCard memberships={(data as any).memberships ?? []} />;
    default:
      return null;
  }
};

interface MwanaBotToolResultCardProps {
  result: MwanaBotToolResult;
}

const MwanaBotToolResultCard: React.FC<MwanaBotToolResultCardProps> = ({ result }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const headerKey = resolveHeaderKey(result.data);
  const header = CARD_HEADER[headerKey];

  const iconColor = header
    ? header.iconColorToken === "error"
      ? theme.colors.error
      : header.iconColorToken === "warning"
        ? theme.colors.warning
        : header.iconColorToken === "success"
          ? theme.colors.success
          : theme.colors.primary
    : theme.colors.primary;

  // Forward-compat fallback: unknown kind still gets a card with the
  // bot's own French summary string.
  if (!header) {
    return (
      <ThemedCard variant="default" style={styles.card}>
        <ThemedText variant="bodySmall" color={theme.colors.textSecondary}>
          {result.summary}
        </ThemedText>
        <ActionButtons actions={result.actions ?? []} />
      </ThemedCard>
    );
  }

  return (
    <ThemedCard variant="default" style={styles.card}>
      <View style={styles.header}>
        <View
          style={[styles.headerIcon, { backgroundColor: iconColor + "18" }]}
        >
          <Ionicons name={header.icon} size={18} color={iconColor} />
        </View>
        <ThemedText variant="subtitle" style={styles.headerTitle}>
          {t(header.titleKey, header.fallbackTitle)}
        </ThemedText>
      </View>
      {renderBody(result.data)}
      <ActionButtons actions={result.actions ?? []} />
    </ThemedCard>
  );
};

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "700",
    flex: 1,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontWeight: "600",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  refPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(128,128,128,0.1)",
  },
  // Balance card
  balanceTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  balanceMain: {
    flex: 1,
  },
  balanceMainValue: {
    fontWeight: "700",
    marginTop: 2,
  },
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  balanceBadgeText: {
    fontWeight: "700",
    fontSize: 10,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  balanceFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  balanceFooterStat: {
    flex: 1,
  },
  balanceFooterValue: {
    fontWeight: "600",
    marginTop: 2,
  },
  // Loyalty
  loyaltyItem: {
    paddingVertical: 4,
  },
  loyaltyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // Action buttons
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionLabel: {
    fontWeight: "700",
  },
  actionIcon: {
    marginLeft: 6,
  },
});

export default MwanaBotToolResultCard;
