import { Title, TitleStatus } from "@/types/financial";

export function daysOverdue(
  dueDateISO: string,
  referenceDateISO: string,
): number {
  const diffTime =
    new Date(referenceDateISO + "T12:00:00").getTime() -
    new Date(dueDateISO + "T12:00:00").getTime();
  const diffDays = Math.floor(diffTime / 86400000);
  return diffDays > 0 ? diffDays : 0;
}

export function isOverdue(
  dueDateISO: string,
  referenceDateISO: string,
): boolean {
  return daysOverdue(dueDateISO, referenceDateISO) > 0;
}

export function deriveStatus(
  title: Title,
  referenceDateISO: string,
): TitleStatus {
  if (["pago", "recebido", "cancelado", "renegociado"].includes(title.status)) {
    return title.status;
  }
  return isOverdue(title.dueDate, referenceDateISO) ? "atrasado" : "previsto";
}
