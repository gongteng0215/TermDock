import type { BuildSettingsCompositePropsArgs } from "./settings-composite-props";

type SettingsShellArgs = BuildSettingsCompositePropsArgs["shell"];

export function buildSettingsShellArgs(
  args: SettingsShellArgs
): SettingsShellArgs {
  return args;
}
