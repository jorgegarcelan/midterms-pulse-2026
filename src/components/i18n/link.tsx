"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocalePath } from "@/components/i18n/locale-provider";

// next/link that keeps the reader in their language: internal string hrefs gain the /en prefix in English.
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const localize = useLocalePath();
  return <NextLink href={typeof href === "string" ? localize(href) : href} {...props} />;
}
