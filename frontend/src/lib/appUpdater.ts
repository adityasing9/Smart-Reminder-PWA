import { Capacitor } from "@capacitor/core";

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  apkDownloadUrl?: string;
  githubReleaseUrl: string;
  publishedAt: string;
}

// Current App Version (matches package.json & Android build version)
export const CURRENT_APP_VERSION = "1.0.2";
export const GITHUB_REPO = "adityasing9/Smart-Reminder-PWA";

/**
 * Compares two semantic version strings (e.g., "1.0.1" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *   -1 if v1 < v2
 *   0 if equal
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim();
  const clean2 = v2.replace(/^v/, "").trim();

  const parts1 = clean1.split(".").map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split(".").map((p) => parseInt(p, 10) || 0);

  const length = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < length; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks GitHub Releases API for newer APK releases
 */
export async function checkForAppUpdates(): Promise<UpdateInfo> {
  const fallbackInfo: UpdateInfo = {
    hasUpdate: false,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
    releaseName: "",
    releaseNotes: "",
    githubReleaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
    publishedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log("No releases found on GitHub yet.");
      }
      return fallbackInfo;
    }

    const releaseData = await response.json();
    const tag = releaseData.tag_name || releaseData.name || "";
    const cleanTag = tag.replace(/^v/, "");

    // Look for an APK file asset in the release
    let apkAsset = null;
    if (Array.isArray(releaseData.assets)) {
      apkAsset = releaseData.assets.find(
        (asset: any) =>
          typeof asset.name === "string" && asset.name.toLowerCase().endsWith(".apk")
      );
    }

    const hasUpdate = compareSemver(cleanTag, CURRENT_APP_VERSION) > 0;

    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanTag || tag,
      releaseName: releaseData.name || tag,
      releaseNotes: releaseData.body || "A new update is available with performance improvements and bug fixes.",
      apkDownloadUrl: apkAsset ? apkAsset.browser_download_url : undefined,
      githubReleaseUrl: releaseData.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      publishedAt: releaseData.published_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    return fallbackInfo;
  }
}

/**
 * Triggers the download / install flow for the APK update
 */
export function startAppUpdate(apkUrl?: string, releaseUrl?: string): void {
  const targetUrl = apkUrl || releaseUrl || `https://github.com/${GITHUB_REPO}/releases/latest`;
  if (typeof window !== "undefined") {
    window.open(targetUrl, "_system");
  }
}
