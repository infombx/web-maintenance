"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SplitSquareHorizontal } from "lucide-react";

interface ScreenshotCompareProps {
  currentUrl?: string | null;
  referenceUrl?: string | null;
  label?: string;
}

export function ScreenshotCompare({ currentUrl, referenceUrl, label }: ScreenshotCompareProps) {
  if (!currentUrl && !referenceUrl) return null;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 text-xs gap-1" />}>
        <SplitSquareHorizontal className="h-3.5 w-3.5" />
        Compare
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{label ?? "Screenshot Comparison"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium">Reference</p>
            {referenceUrl ? (
              <img
                src={referenceUrl}
                alt="Reference screenshot"
                className="w-full rounded border object-top object-cover max-h-96"
              />
            ) : (
              <div className="h-48 bg-zinc-100 rounded flex items-center justify-center text-sm text-zinc-400">
                No reference
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium">Current</p>
            {currentUrl ? (
              <img
                src={currentUrl}
                alt="Current screenshot"
                className="w-full rounded border object-top object-cover max-h-96"
              />
            ) : (
              <div className="h-48 bg-zinc-100 rounded flex items-center justify-center text-sm text-zinc-400">
                No screenshot
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
