-- Add FK ClarificationRequest -> Pointage for workflow queries
ALTER TABLE "ClarificationRequest" ADD CONSTRAINT "ClarificationRequest_pointageId_fkey" FOREIGN KEY ("pointageId") REFERENCES "Pointage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
