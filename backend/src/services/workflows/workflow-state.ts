import { ClarificationStatus, RequestStatus } from "@prisma/client";
import { ApiError } from "../../middleware/error-handler.js";

export class WorkflowTransitionError extends ApiError {
  constructor(message: string) {
    super(409, "INVALID_TRANSITION", message);
  }
}

export function assertActivityDecisionAllowed(current: RequestStatus): void {
  if (current !== RequestStatus.PENDING) {
    throw new WorkflowTransitionError("Seules les demandes en attente peuvent être traitées");
  }
}

export function assertActivityCancelAllowed(current: RequestStatus): void {
  if (current !== RequestStatus.PENDING) {
    throw new WorkflowTransitionError("Seules les demandes en attente peuvent être annulées");
  }
}

export function assertClarificationAnswerAllowed(current: ClarificationStatus): void {
  if (current !== ClarificationStatus.OPEN) {
    throw new WorkflowTransitionError("Seules les demandes ouvertes peuvent recevoir une réponse");
  }
}

export function assertClarificationCloseAllowed(current: ClarificationStatus): void {
  if (current !== ClarificationStatus.ANSWERED) {
    throw new WorkflowTransitionError("Seules les demandes répondues peuvent être clôturées");
  }
}
