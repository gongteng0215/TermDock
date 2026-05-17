import { useMemo } from "react";

import {
  findDangerousCommandGroupAssignment,
  formatDangerousCommandSourceLabel,
  summarizeDangerousCommandCustomPatterns,
  type DangerousCommandBuiltinRuleDefinition,
  type DangerousCommandEnvironmentTemplateDefinition,
  type DangerousCommandExecutionSource,
  type DangerousCommandExecutionSourceDefinition,
  type DangerousCommandGuardPreferences,
  type DangerousCommandInspectionResult,
  type DangerousCommandPersistentApproval,
  type DangerousCommandPolicyPackDefinition
} from "./dangerous-command-guard";

interface DangerousCommandTemporaryApprovalLike {
  id: string;
  scope: "tab" | "sessionGroup";
  tabId: string | null;
  tabTitle: string;
  sessionGroupName: string | null;
  source: DangerousCommandExecutionSource;
  sourceLabel: string;
  commandText: string;
  preview: string;
  severity: DangerousCommandInspectionResult["severity"];
  appliedPolicyPackId: DangerousCommandGuardPreferences["policyPackId"];
  appliedEnvironmentTemplateId: DangerousCommandGuardPreferences["environmentTemplateId"];
  createdAt: number;
}

interface DangerousCommandPolicyBundleRecordLike {
  id: string;
  name: string;
  description: string;
  updatedAtIso: string;
  preferences: DangerousCommandGuardPreferences;
}

interface DangerousCommandPolicyBundleSyncStateLike {
  filePath: string;
  lastPulledAtIso: string | null;
  lastPushedAtIso: string | null;
}

interface UseDangerousCommandSettingsViewModelsArgs {
  activeSessionGroupName: string | null;
  activeTabSessionGroupName: string | null;
  builtinRules: DangerousCommandBuiltinRuleDefinition[];
  environmentTemplates: DangerousCommandEnvironmentTemplateDefinition[];
  executionSources: DangerousCommandExecutionSourceDefinition[];
  formatPersistentApprovalScopeLabel: (approval: DangerousCommandPersistentApproval) => string;
  formatTemporaryApprovalScopeLabel: (
    approval: DangerousCommandTemporaryApprovalLike
  ) => string;
  maxGroupAssignmentCount: number;
  policyBundles: DangerousCommandPolicyBundleRecordLike[];
  policyBundleSyncState: DangerousCommandPolicyBundleSyncStateLike;
  policyPacks: DangerousCommandPolicyPackDefinition[];
  preferences: DangerousCommandGuardPreferences;
  temporaryApprovals: DangerousCommandTemporaryApprovalLike[];
}

export function useDangerousCommandSettingsViewModels({
  activeSessionGroupName,
  activeTabSessionGroupName,
  builtinRules,
  environmentTemplates,
  executionSources,
  formatPersistentApprovalScopeLabel,
  formatTemporaryApprovalScopeLabel,
  maxGroupAssignmentCount,
  policyBundles,
  policyBundleSyncState,
  policyPacks,
  preferences,
  temporaryApprovals
}: UseDangerousCommandSettingsViewModelsArgs) {
  return useMemo(() => {
    const fallbackPolicyPack = policyPacks[0]!;
    const fallbackEnvironmentTemplate = environmentTemplates[0]!;
    const policyPackLabelById = new Map(policyPacks.map((pack) => [pack.id, pack.label]));
    const environmentTemplateById = new Map(
      environmentTemplates.map((template) => [template.id, template])
    );
    const environmentTemplateLabelById = new Map(
      environmentTemplates.map((template) => [template.id, template.label])
    );
    const selectedDangerousCommandPolicyPack =
      policyPacks.find((pack) => pack.id === preferences.policyPackId) ?? fallbackPolicyPack;
    const selectedDangerousCommandEnvironmentTemplate =
      environmentTemplates.find(
        (template) => template.id === preferences.environmentTemplateId
      ) ?? fallbackEnvironmentTemplate;
    const dangerousCommandCustomPatternSummary = summarizeDangerousCommandCustomPatterns(
      preferences.customPatternsText
    );
    const enabledDangerousCommandSourceCount = executionSources.filter(
      (source) => preferences.sourceStates[source.id]
    ).length;
    const enabledDangerousCommandBuiltinRuleCount = builtinRules.filter(
      (rule) => preferences.builtinRuleStates[rule.id]
    ).length;
    const dangerousCommandSettingsTargetGroupName =
      activeTabSessionGroupName || activeSessionGroupName?.trim() || null;
    const activeDangerousCommandGroupAssignment = findDangerousCommandGroupAssignment(
      preferences,
      dangerousCommandSettingsTargetGroupName
    );
    const dangerousCommandGroupAssignmentLimitReached =
      !activeDangerousCommandGroupAssignment &&
      preferences.groupAssignments.length >= maxGroupAssignmentCount;
    const dangerousCommandExecutionSourceViews = executionSources.map((source) => ({
      id: source.id,
      label: source.label,
      description: source.description,
      checked: preferences.sourceStates[source.id]
    }));
    const dangerousCommandPolicyPackViews = policyPacks.map((pack) => ({
      id: pack.id,
      label: pack.label,
      description: pack.description,
      extraRuleCount: pack.extraRules.length,
      isActive: pack.id === preferences.policyPackId
    }));
    const dangerousCommandEnvironmentTemplateViews = environmentTemplates.map((template) => ({
      id: template.id,
      label: template.label,
      description: template.description,
      recommendedPolicyPackLabel:
        policyPackLabelById.get(template.recommendedPolicyPackId) ??
        template.recommendedPolicyPackId,
      extraRuleCount: template.extraRules.length,
      isActive: template.id === preferences.environmentTemplateId
    }));
    const dangerousCommandSupplementalRuleViews = [
      ...selectedDangerousCommandPolicyPack.extraRules.map((rule) => ({
        id: `${selectedDangerousCommandPolicyPack.label}-${rule.id}`,
        label: rule.label,
        description: rule.description,
        severity: rule.severity,
        sourceLabel: selectedDangerousCommandPolicyPack.label
      })),
      ...selectedDangerousCommandEnvironmentTemplate.extraRules.map((rule) => ({
        id: `${selectedDangerousCommandEnvironmentTemplate.label}-${rule.id}`,
        label: rule.label,
        description: rule.description,
        severity: rule.severity,
        sourceLabel: selectedDangerousCommandEnvironmentTemplate.label
      }))
    ];
    const dangerousCommandTargetGroupHint = activeTabSessionGroupName
      ? "Using the active tab session group."
      : activeSessionGroupName?.trim()
        ? "Using the group currently selected in Sessions."
        : "Focus a grouped tab or select a group in Sessions to save an override.";
    const dangerousCommandGroupAssignmentViews = preferences.groupAssignments.map((assignment) => ({
      groupName: assignment.groupName,
      policyPackLabel: policyPackLabelById.get(assignment.policyPackId) ?? assignment.policyPackId,
      environmentTemplateLabel:
        environmentTemplateLabelById.get(assignment.environmentTemplateId) ??
        assignment.environmentTemplateId,
      isCurrentTarget: dangerousCommandSettingsTargetGroupName
        ? assignment.groupName.toLowerCase() ===
          dangerousCommandSettingsTargetGroupName.toLowerCase()
        : false
    }));
    const dangerousCommandTemporaryApprovalViews = temporaryApprovals.map((approval) => ({
      id: approval.id,
      title: approval.preview || approval.commandText,
      severity: approval.severity,
      scopeLabel: formatTemporaryApprovalScopeLabel(approval),
      sourceLabel: approval.sourceLabel,
      policyPackLabel:
        policyPackLabelById.get(approval.appliedPolicyPackId) ??
        approval.appliedPolicyPackId,
      environmentTemplateLabel:
        environmentTemplateLabelById.get(approval.appliedEnvironmentTemplateId) ??
        approval.appliedEnvironmentTemplateId,
      createdAtLabel: new Date(approval.createdAt).toLocaleString()
    }));
    const dangerousCommandPersistentApprovalViews = preferences.persistentApprovals.map(
      (approval) => ({
        id: approval.id,
        title: approval.preview || approval.commandText,
        severity: approval.severity,
        scopeLabel: formatPersistentApprovalScopeLabel(approval),
        sourceLabel: formatDangerousCommandSourceLabel(approval.source),
        policyPackLabel:
          policyPackLabelById.get(approval.appliedPolicyPackId) ??
          approval.appliedPolicyPackId,
        environmentTemplateLabel:
          environmentTemplateLabelById.get(approval.appliedEnvironmentTemplateId) ??
          approval.appliedEnvironmentTemplateId,
        createdAtLabel: new Date(approval.createdAtIso).toLocaleString()
      })
    );
    const dangerousCommandPolicyBundleViews = policyBundles.map((bundle) => {
      const bundlePatternSummary = summarizeDangerousCommandCustomPatterns(
        bundle.preferences.customPatternsText
      );
      const bundleEnabledSourceCount = executionSources.filter(
        (source) => bundle.preferences.sourceStates[source.id]
      ).length;
      return {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        policyPackLabel:
          policyPackLabelById.get(bundle.preferences.policyPackId) ??
          bundle.preferences.policyPackId,
        environmentTemplateLabel:
          environmentTemplateById.get(bundle.preferences.environmentTemplateId)?.label ??
          bundle.preferences.environmentTemplateId,
        enabledSourceCount: bundleEnabledSourceCount,
        totalSourceCount: executionSources.length,
        groupOverrideCount: bundle.preferences.groupAssignments.length,
        persistentPolicyCount: bundle.preferences.persistentApprovals.length,
        customPatternCount: bundlePatternSummary.activePatterns,
        updatedAtLabel: new Date(bundle.updatedAtIso).toLocaleString()
      };
    });
    const dangerousCommandPolicyBundleLastPulledLabel = policyBundleSyncState.lastPulledAtIso
      ? new Date(policyBundleSyncState.lastPulledAtIso).toLocaleString()
      : null;
    const dangerousCommandPolicyBundleLastPushedLabel = policyBundleSyncState.lastPushedAtIso
      ? new Date(policyBundleSyncState.lastPushedAtIso).toLocaleString()
      : null;
    const dangerousCommandBuiltinRuleViews = builtinRules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      severity: rule.severity,
      checked: preferences.builtinRuleStates[rule.id]
    }));

    return {
      activeDangerousCommandGroupAssignment,
      dangerousCommandBuiltinRuleViews,
      dangerousCommandCustomPatternSummary,
      dangerousCommandEnvironmentTemplateViews,
      dangerousCommandExecutionSourceViews,
      dangerousCommandGroupAssignmentLimitReached,
      dangerousCommandGroupAssignmentViews,
      dangerousCommandPersistentApprovalViews,
      dangerousCommandPolicyBundleLastPulledLabel,
      dangerousCommandPolicyBundleLastPushedLabel,
      dangerousCommandPolicyBundleViews,
      dangerousCommandPolicyPackViews,
      dangerousCommandSettingsTargetGroupName,
      dangerousCommandSupplementalRuleViews,
      dangerousCommandTargetGroupHint,
      dangerousCommandTemporaryApprovalViews,
      enabledDangerousCommandBuiltinRuleCount,
      enabledDangerousCommandSourceCount,
      selectedDangerousCommandEnvironmentTemplate,
      selectedDangerousCommandPolicyPack
    };
  }, [
    activeSessionGroupName,
    activeTabSessionGroupName,
    builtinRules,
    environmentTemplates,
    executionSources,
    formatPersistentApprovalScopeLabel,
    formatTemporaryApprovalScopeLabel,
    maxGroupAssignmentCount,
    policyBundles,
    policyBundleSyncState.lastPulledAtIso,
    policyBundleSyncState.lastPushedAtIso,
    policyPacks,
    preferences,
    temporaryApprovals
  ]);
}
