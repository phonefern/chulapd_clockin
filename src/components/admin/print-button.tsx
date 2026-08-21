"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button className="gap-2" onClick={() => window.print()} type="button">
      <Printer className="size-4" />
      พิมพ์
    </Button>
  );
}
