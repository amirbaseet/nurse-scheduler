import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DRAFT"
  | "GENERATED"
  | "PUBLISHED";

const statusStyles: Record<Status, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVED: "bg-green-100 text-green-800 border-green-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
  DRAFT: "bg-gray-100 text-gray-800 border-gray-300",
  GENERATED: "bg-blue-100 text-blue-800 border-blue-300",
  PUBLISHED: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const statusLabels: Record<Status, { he: string; ar: string }> = {
  PENDING: { he: "ממתין", ar: "قيد الانتظار" },
  APPROVED: { he: "אושר", ar: "تمت الموافقة" },
  REJECTED: { he: "נדחה", ar: "مرفوض" },
  DRAFT: { he: "טיוטה", ar: "مسودة" },
  GENERATED: { he: "נוצר", ar: "تم الإنشاء" },
  PUBLISHED: { he: "פורסם", ar: "تم النشر" },
};

export function StatusBadge({
  status,
  locale = "he",
  className,
}: {
  status: Status;
  locale?: "he" | "ar";
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(statusStyles[status], className)}
    >
      {statusLabels[status][locale]}
    </Badge>
  );
}
