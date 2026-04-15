// "PROCESSED" is intentionally excluded — it means the terminal completed an interaction
// (could be approved OR declined). Use internalStatus ("APPROVED"/"FAILED") from the backend
// to determine the real outcome.
export const SUCCESS_POS_STATUSES = new Set(["APPROVED", "SUCCESS", "COMPLETED"]);
export const FAILURE_POS_STATUSES = new Set(["FAILED", "DECLINED", "REJECTED", "ERROR"]);
export const CANCELLED_POS_STATUSES = new Set(["CANCELLED", "CANCELED", "VOIDED", "EXPIRED"]);

export const normalizePosStatus = (status?: string | null) => (status || "").toUpperCase();

export const isSuccessPosStatus = (status?: string | null) =>
  SUCCESS_POS_STATUSES.has(normalizePosStatus(status));

export const isFailurePosStatus = (status?: string | null) => {
  const normalized = normalizePosStatus(status);
  return FAILURE_POS_STATUSES.has(normalized) || CANCELLED_POS_STATUSES.has(normalized);
};

export const extractApprovedAmountKobo = (responseData: any): number | null => {
  const amount = responseData?.approvedAmountKobo ?? responseData?.approved_amount ?? responseData?.approvedAmount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return Math.round(amount);
  }
  if (typeof amount === "string") {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return null;
};
