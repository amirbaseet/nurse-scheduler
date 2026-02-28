"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: "LOW" | "NORMAL" | "URGENT";
  targetAll: boolean;
  expiresAt: string | null;
  createdAt: string;
  isRead: boolean;
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  NORMAL: "bg-blue-100 text-blue-700",
  URGENT: "bg-red-100 text-red-700 font-bold",
};

const PRIORITY_ICONS: Record<string, string> = {
  LOW: "⚪",
  NORMAL: "🔵",
  URGENT: "🔴",
};

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function NurseAnnouncementsPage() {
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const markedReadRef = useRef(new Set<string>());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAnnouncements)
      .finally(() => setLoading(false));
  }, []);

  // Set up IntersectionObserver for auto-mark-read
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-announcement-id");
            if (id && !markedReadRef.current.has(id)) {
              markedReadRef.current.add(id);
              // Fire and forget — mark as read
              fetch(`/api/announcements/${id}/read`, { method: "POST" }).catch(
                () => {},
              );
              setAnnouncements((prev) =>
                prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
              );
              // Stop observing this element
              observerRef.current?.unobserve(entry.target);
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const observeRef = useCallback(
    (el: HTMLElement | null, announcement: Announcement) => {
      if (!el || announcement.isRead || markedReadRef.current.has(announcement.id))
        return;
      el.setAttribute("data-announcement-id", announcement.id);
      observerRef.current?.observe(el);
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">{t("announcements")}</h1>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_announcements")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card
              key={ann.id}
              ref={(el) => observeRef(el, ann)}
              className={cn(
                ann.priority === "URGENT" && "border-red-200",
                ann.isRead && "opacity-60",
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0">
                    {PRIORITY_ICONS[ann.priority]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "font-medium",
                          !ann.isRead && "font-bold",
                        )}
                      >
                        {ann.title}
                      </span>
                      <Badge
                        className={cn("shrink-0 text-xs", PRIORITY_STYLES[ann.priority])}
                      >
                        {t(`priority_${ann.priority.toLowerCase()}`)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ann.body}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{formatDateHe(ann.createdAt)}</span>
                      {ann.expiresAt && (
                        <>
                          <span>•</span>
                          <span>{t("expires_at")}: {formatDateHe(ann.expiresAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
