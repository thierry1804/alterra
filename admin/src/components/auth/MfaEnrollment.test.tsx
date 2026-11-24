import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("../../lib/api", () => ({ api: { post } }));

import { useAuthStore } from "../../lib/auth-store";
import MfaEnrollment from "./MfaEnrollment";

const axiosError = (status: number, data: object) =>
  Object.assign(new Error(String(status)), { isAxiosError: true, response: { status, data } });

function setup() {
  const onSessionOpen = vi.fn();
  const onBack = vi.fn();
  render(<MfaEnrollment enrollmentToken="tok" onSessionOpen={onSessionOpen} onBack={onBack} />);
  return { onSessionOpen, onBack, user: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null });
  post.mockImplementation(async (url: string) =>
    url.endsWith("/setup")
      ? { data: { qrCodeDataUrl: "data:image/png;base64,AAAA" } }
      : { data: { accessToken: "jwt", user: { id: "u1", firstName: "A", lastName: "B" } } },
  );
});

describe("MfaEnrollment", () => {
  it("affiche le QR code obtenu avec le jeton d'activation", async () => {
    setup();
    expect(await screen.findByRole("img", { name: /Code QR/ })).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA",
    );
    expect(post).toHaveBeenCalledWith(
      "/auth/mfa/enroll/setup",
      {},
      { headers: { Authorization: "Bearer tok" } },
    );
  });

  it("n'active le bouton qu'avec 6 chiffres, puis ouvre la session", async () => {
    const { user, onSessionOpen } = setup();
    await screen.findByRole("img", { name: /Code QR/ });
    const submit = screen.getByRole("button", { name: "Activer et me connecter" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Saisissez le code/), "12a3456");
    expect(screen.getByLabelText(/Saisissez le code/)).toHaveValue("123456");
    await user.click(submit);

    await waitFor(() => expect(onSessionOpen).toHaveBeenCalled());
    expect(post).toHaveBeenLastCalledWith(
      "/auth/mfa/enroll/verify",
      { code: "123456" },
      { headers: { Authorization: "Bearer tok" } },
    );
    expect(useAuthStore.getState().accessToken).toBe("jwt");
  });

  it("explique un code invalide sans ouvrir de session", async () => {
    post.mockImplementation(async (url: string) => {
      if (url.endsWith("/setup")) return { data: { qrCodeDataUrl: "data:image/png;base64,AAAA" } };
      throw axiosError(401, { code: "INVALID_MFA_CODE" });
    });
    const { user, onSessionOpen } = setup();
    await screen.findByRole("img", { name: /Code QR/ });
    await user.type(screen.getByLabelText(/Saisissez le code/), "000000");
    await user.click(screen.getByRole("button", { name: "Activer et me connecter" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Code invalide");
    expect(onSessionOpen).not.toHaveBeenCalled();
  });

  it("propose de se reconnecter quand la session d'activation a expiré", async () => {
    post.mockRejectedValue(axiosError(401, { code: "INVALID_ENROLLMENT_TOKEN" }));
    const { user, onBack } = setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Session expirée");
    await user.click(screen.getByRole("button", { name: "Retour à la connexion" }));
    expect(onBack).toHaveBeenCalled();
  });
});
