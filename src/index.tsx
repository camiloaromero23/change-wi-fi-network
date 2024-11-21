import {
  Action,
  ActionPanel,
  Icon,
  List,
  PopToRootType,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";

import { exec } from "child_process";
import { useEffect, useState } from "react";
import { promisify } from "util";

const execAsync = promisify(exec);

async function envPath(): Promise<string> {
  const { stdout: path } = await execAsync("echo $PATH");

  return [path.trim(), "/opt/homebrew/bin"].join(":");
}

export default function Command() {
  const [networks, setNetworks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { stderr, stdout: listCommandOutput } = await execAsync(
          `/usr/sbin/networksetup -listpreferredwirelessnetworks en0 | tail -n +2 | sed 's/^[[:space:]]*//'`,
          { encoding: "utf-8" },
        );

        if (stderr) {
          throw new Error(stderr);
        }

        const networkList = listCommandOutput
          .split("\n")
          .filter((network) => network.trim() !== "");
        setNetworks(networkList);
      } catch (error) {
        showToast(
          Toast.Style.Failure,
          "Failed to fetch networks",
          String(error),
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleNetworkSelect = async (network: string) => {
    const command = `pass wifi | grep "${network}" | sed 's/.*: \\(.*\\)/\\1/g'`;

    try {
      const { stdout: password, stderr: passwordErr } = await execAsync(
        command,
        {
          encoding: "utf-8",
          timeout: 2000,
          env: {
            ...process.env,
            PATH: await envPath(),
            PASSWORD_STORE_DIR: "/Users/camilo/.password-store",
          },
        },
      );

      if (passwordErr || password.trim() === "") {
        throw new Error(passwordErr);
      }

      const changeNetworkCommand = `networksetup -setairportnetwork en0 "${network}" "${password.trim()}"`;

      // await showToast(Toast.Style.Animated, "Changing Network...");

      // await popToRoot({ clearSearchBar: true });
      // await closeMainWindow({ clearRootSearch: true });
      await showHUD(`⏳ Changing Network to ${network}`);

      const { stderr } = await execAsync(changeNetworkCommand, {
        encoding: "utf-8",
        env: {
          // ...process.env,
          PATH: "/usr/sbin",
          PASSWORD_STORE_DIR: "/Users/camilo/.password-store",
        },
      });

      if (stderr) {
        throw new Error(stderr);
      }

      await showHUD("🟢 Network Changed", {
        popToRootType: PopToRootType.Immediate,
        clearRootSearch: true,
      });

      // await showToast(Toast.Style.Success, `Network Changed to ${network}`);
    } catch (error) {
      await showHUD(`🔴 Failed to set network ${network}`, {
        popToRootType: PopToRootType.Immediate,
        clearRootSearch: true,
      });
    }
  };

  return (
    <List isLoading={isLoading}>
      {networks.map((network) => (
        <List.Item
          key={network}
          title={network}
          icon={Icon.Wifi}
          actions={
            <ActionPanel>
              <Action
                title="Select Network"
                onAction={async () => await handleNetworkSelect(network)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
