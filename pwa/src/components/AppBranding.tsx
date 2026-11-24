import { useEffect } from "react";
import { useAppSettings } from "../hooks/useAppSettings";

/**
 * Applique le nom de l'application réglé dans l'administration à l'onglet et au nom proposé à
 * l'installation sur l'écran d'accueil (iOS lit `apple-mobile-web-app-title` ; Android lit le manifeste,
 * déjà généré par le serveur avec ce même nom).
 */
export default function AppBranding() {
  const { appName } = useAppSettings();

  useEffect(() => {
    document.title = `${appName} - Terrain`;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "apple-mobile-web-app-title";
      document.head.appendChild(meta);
    }
    meta.content = appName;
  }, [appName]);

  return null;
}
