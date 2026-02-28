"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  KeyRound,
  UserX,
  Shield,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRecord = {
  id: string;
  name: string;
  nameAr: string | null;
  role: "MANAGER" | "NURSE";
  isActive: boolean;
  phone: string | null;
  nurseProfile: {
    contractHours: number;
    gender: string;
    isManager: boolean;
  } | null;
};

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "מנהלת",
  NURSE: "אחות",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Reset PIN dialog
  const [pinTarget, setPinTarget] = useState<UserRecord | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  // Deactivate dialog
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  const handleResetPin = useCallback(async () => {
    if (!pinTarget || !newPin) return;

    const expectedLen = pinTarget.role === "NURSE" ? 4 : 6;
    if (newPin.length !== expectedLen || !/^\d+$/.test(newPin)) {
      setPinError(`PIN חייב להיות ${expectedLen} ספרות`);
      return;
    }

    setPinSaving(true);
    setPinError("");
    try {
      const res = await fetch(`/api/users/${pinTarget.id}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });

      if (res.ok) {
        setPinTarget(null);
        setNewPin("");
      } else {
        const data = await res.json();
        setPinError(data.error ?? "שגיאה באיפוס PIN");
      }
    } catch (err) {
      console.error("Failed to reset PIN:", err);
      setPinError("שגיאה באיפוס PIN");
    } finally {
      setPinSaving(false);
    }
  }, [pinTarget, newPin]);

  const handleDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/users/${deactivateTarget.id}/deactivate`, {
        method: "PUT",
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === deactivateTarget.id ? { ...u, isActive: false } : u,
          ),
        );
        setDeactivateTarget(null);
      }
    } catch (err) {
      console.error("Failed to deactivate user:", err);
    } finally {
      setDeactivating(false);
    }
  }, [deactivateTarget]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">משתמשים</h1>
        <Badge variant="outline">
          <Users className="h-3 w-3 me-1" />
          {users.filter((u) => u.isActive).length} פעילים
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>שעות חוזה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-end">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={!user.isActive ? "opacity-50" : undefined}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium">{user.name}</span>
                      {user.nameAr && (
                        <span className="text-xs text-muted-foreground ms-2">
                          {user.nameAr}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "MANAGER" ? "default" : "secondary"}
                    >
                      {user.role === "MANAGER" && (
                        <Shield className="h-3 w-3 me-1" />
                      )}
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.nurseProfile?.contractHours ?? "—"}
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge className="bg-green-100 text-green-700">פעיל</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-500">לא פעיל</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPinTarget(user);
                          setNewPin("");
                          setPinError("");
                        }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      {user.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeactivateTarget(user)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reset PIN dialog */}
      <Dialog
        open={!!pinTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPinTarget(null);
            setNewPin("");
            setPinError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>איפוס PIN</DialogTitle>
            <DialogDescription>
              הגדר PIN חדש ל{pinTarget?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>PIN חדש</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={pinTarget?.role === "NURSE" ? 4 : 6}
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value.replace(/\D/g, ""));
                  setPinError("");
                }}
                placeholder={
                  pinTarget?.role === "NURSE" ? "4 ספרות" : "6 ספרות"
                }
              />
              {pinError && (
                <p className="text-xs text-red-600">{pinError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPinTarget(null)}
              disabled={pinSaving}
            >
              ביטול
            </Button>
            <Button
              onClick={handleResetPin}
              disabled={pinSaving || !newPin}
            >
              {pinSaving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              איפוס
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>השבתת משתמש</DialogTitle>
            <DialogDescription>
              להשבית את חשבון {deactivateTarget?.name}?
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            המשתמש לא יוכל להתחבר למערכת לאחר ההשבתה.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={deactivating}
            >
              ביטול
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating && (
                <Loader2 className="h-4 w-4 animate-spin me-2" />
              )}
              השבתה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
