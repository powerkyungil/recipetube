import type { MetadataRoute } from "next";
import { guides } from "@/lib/guides";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/extract", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: new URL("/guides", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...guides.map((guide) => ({
      url: new URL(`/guides/${guide.slug}`, siteUrl).toString(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
