import { ReactNode } from "react";
import { useAppSettings } from "../../hooks/useAppSettings";

interface AuthLayoutProps {
  subtitle: string;
  /** Titre de la page (par défaut « Bonjour »). */
  title?: string;
  children: ReactNode;
}

export default function AuthLayout({ subtitle, title, children }: AuthLayoutProps) {
  const { appName, iconUrl, loginBackgroundUrl, loginBranchUrl, loginLeafUrl } = useAppSettings();

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-white">
      <img
        src={loginBranchUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 z-10 w-40 xl:w-56"
      />
      <img
        src={loginLeafUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 z-10 w-32 xl:w-48"
      />

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${loginBackgroundUrl}')` }}
        role="img"
        aria-label="Champ agricole ALTERRA"
      />
      <div className="hidden lg:block lg:w-1/2" />

      <div className="relative flex w-full flex-col justify-center bg-white/85 px-6 py-10 backdrop-blur-sm sm:px-10 lg:w-1/2 lg:px-14">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <img src={iconUrl} alt="ALTERRA" className="h-20 w-auto" />
            <div>
              <h1 className="alterra-display text-3xl font-extrabold tracking-tight text-zinc-900">
                {title ?? "Bonjour"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {appName} · {subtitle}
              </p>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
